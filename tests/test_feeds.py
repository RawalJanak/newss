from pathlib import Path
from server.feeds import parse_feed, filter_new, mark_seen

FIXTURE = Path(__file__).parent / "fixtures" / "sample_rss.xml"

def test_parse_feed_returns_items():
    items = parse_feed(FIXTURE.read_bytes(), source="Test Feed")
    assert len(items) == 2
    first = items[0]
    assert first["title"] == "Nifty hits record high on IT rally"
    assert first["url"] == "https://example.com/nifty-record"
    assert first["source"] == "Test Feed"
    # 09:30 +0530 == 04:00 UTC; full assertion catches timezone regressions
    assert first["published"] == "2026-07-01T04:00:00+00:00"
    assert "IT stocks" in first["summary"]


def test_parse_feed_skips_entries_missing_link_or_title():
    content = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Partial Feed</title>
    <item>
      <title>No link here</title>
      <description>Entry without a link.</description>
    </item>
    <item>
      <link>https://example.com/no-title</link>
      <description>Entry without a title.</description>
    </item>
    <item>
      <title>Complete entry</title>
      <link>https://example.com/complete</link>
      <description>Has both title and link.</description>
    </item>
  </channel>
</rss>
"""
    items = parse_feed(content, source="Partial Feed")
    assert len(items) == 1
    assert items[0]["title"] == "Complete entry"
    assert items[0]["url"] == "https://example.com/complete"


def test_parse_feed_uses_updated_when_no_published_date():
    content = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom entry with updated only</title>
    <link href="https://example.com/atom-entry"/>
    <updated>2026-07-01T10:00:00Z</updated>
  </entry>
</feed>
"""
    items = parse_feed(content, source="Atom Feed")
    assert len(items) == 1
    assert items[0]["published"] == "2026-07-01T10:00:00+00:00"


def test_filter_new_drops_seen_urls(tmp_path, monkeypatch):
    import server.feeds as feeds
    monkeypatch.setattr(feeds, "SEEN_PATH", tmp_path / "seen.json")
    items = [
        {"url": "https://example.com/a", "title": "A"},
        {"url": "https://example.com/b", "title": "B"},
    ]
    assert len(filter_new(items)) == 2
    mark_seen([items[0]])
    remaining = filter_new(items)
    assert len(remaining) == 1
    assert remaining[0]["url"] == "https://example.com/b"


def test_seen_store_prunes_old_entries(tmp_path, monkeypatch):
    import json, time
    import server.feeds as feeds
    seen_file = tmp_path / "seen.json"
    monkeypatch.setattr(feeds, "SEEN_PATH", seen_file)
    old = time.time() - 8 * 86400
    seen_file.write_text(json.dumps({"https://example.com/old": old}))
    mark_seen([{"url": "https://example.com/new"}])
    data = json.loads(seen_file.read_text())
    assert "https://example.com/old" not in data
    assert "https://example.com/new" in data
