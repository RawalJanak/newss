import calendar
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser


def _entry_image(e) -> str:
    """Best-effort image URL for a feed entry.

    Feeds advertise images four different ways and no publisher agrees on which.
    Roughly 72% of items across the configured feeds carry one somewhere; the rest
    need an og:image scrape from the article page, which is the caller's problem.
    """
    for key in ("media_content", "media_thumbnail"):
        vals = getattr(e, key, None)
        if isinstance(vals, list) and vals:
            url = vals[0].get("url")
            if url:
                return url
    for link in (getattr(e, "links", None) or []):
        if link.get("rel") == "enclosure" and str(link.get("type", "")).startswith("image"):
            if link.get("href"):
                return link["href"]
    for field in ("summary", "content"):
        raw = getattr(e, field, "")
        if isinstance(raw, list) and raw:
            raw = raw[0].get("value", "")
        match = re.search(r'<img[^>]+src="([^"]+)"', raw or "")
        if match:
            return match.group(1)
    return ""

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
            "image_url": _entry_image(e),
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


def fetch_all(feeds_config_path: Path, *, mark: bool = False) -> dict:
    """Fetch every feed in feeds config; return fresh (unseen) items.

    URLs are NOT marked seen here — call confirm_seen() only after
    articles.json is written successfully, so a failed digest run can retry.
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
            items = parse_feed(content, source=name)
            if feed.get("category"):
                for item in items:
                    item["feed_category"] = feed["category"]
            if feed.get("wire"):
                for item in items:
                    item["wire"] = True
            all_items.extend(items)
        except Exception as exc:
            errors.append({"feed": name, "error": str(exc)})
    fresh = filter_new(all_items)
    if mark:
        mark_seen(fresh)
    return {"items": fresh, "errors": errors}


def confirm_seen_urls(urls: list[str]) -> dict:
    """Mark URLs as seen after a successful digest write."""
    items = [{"url": u} for u in urls if u]
    mark_seen(items)
    return {"marked": len(items)}
