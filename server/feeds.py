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


def _load_seen() -> dict:
    if SEEN_PATH.exists():
        try:
            return json.loads(SEEN_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def _save_seen(seen: dict) -> None:
    SEEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - SEEN_TTL_DAYS * 86400
    pruned = {u: ts for u, ts in seen.items() if ts >= cutoff}
    SEEN_PATH.write_text(json.dumps(pruned), encoding="utf-8")


def filter_new(items: list[dict]) -> list[dict]:
    seen = _load_seen()
    return [i for i in items if i["url"] not in seen]


def mark_seen(items: list[dict]) -> None:
    seen = _load_seen()
    now = time.time()
    for i in items:
        seen[i["url"]] = now
    _save_seen(seen)


def fetch_all(feeds_config_path: Path) -> dict:
    """Fetch every feed in feeds config, return fresh (unseen) items, mark them seen.

    At-most-once delivery by design: items are marked seen immediately, so if a
    downstream consumer crashes before using them, that batch is skipped, never
    re-delivered. Acceptable for a twice-daily personal digest; do not add
    retry/unmark machinery without revisiting.
    """
    import urllib.request

    config = json.loads(feeds_config_path.read_text(encoding="utf-8"))
    all_items, errors = [], []
    for feed in config["feeds"]:
        name = feed["name"]
        url = feed["url"]
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (news-agent)"}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                content = resp.read()
            all_items.extend(parse_feed(content, source=name))
        except Exception as exc:
            errors.append({"feed": name, "error": str(exc)})
    fresh = filter_new(all_items)
    mark_seen(fresh)
    return {"items": fresh, "errors": errors}
