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
    assert first["published"].startswith("2026-07-01")
    assert "IT stocks" in first["summary"]
