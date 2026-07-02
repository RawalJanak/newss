from pathlib import Path
from server.feeds import parse_feed

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
