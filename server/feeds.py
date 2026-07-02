import calendar
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser

STATE_DIR = Path(__file__).parent / "state"
SEEN_PATH = STATE_DIR / "seen_urls.json"
SEEN_TTL_DAYS = 7


def parse_feed(content: bytes, source: str) -> list[dict]:
    """Parse raw RSS/Atom bytes into normalized headline items."""
    parsed = feedparser.parse(content)
    items = []
    for e in parsed.entries:
        url = getattr(e, "link", None)
        title = getattr(e, "title", None)
        if not url or not title:
            continue
        published = ""
        t = getattr(e, "published_parsed", None) or getattr(e, "updated_parsed", None)
        if t:
            published = datetime.fromtimestamp(
                calendar.timegm(t), tz=timezone.utc
            ).isoformat()
        items.append({
            "title": title.strip(),
            "url": url,
            "source": source,
            "published": published,
            "summary": getattr(e, "summary", "")[:500],
        })
    return items
