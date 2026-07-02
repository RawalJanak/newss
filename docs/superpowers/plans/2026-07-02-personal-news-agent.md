# Personal News Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twice-daily personalized news feed: RSS discovery + news-please extraction exposed as a local MCP server, a Claude Code scheduled routine that ranks/summarizes against a profile, and an app-style HTML news reader.

**Architecture:** Python MCP server (FastMCP, stdio) with two tools — `fetch_headlines` (RSS via feedparser + seen-URL dedupe) and `extract_articles` (news-please with trafilatura fallback). A scheduled Claude Code task calls the tools, ranks against `profile.md`, summarizes with Claude itself, writes `app/articles.json`. Static `app/index.html` renders the feed (ET/Google News style).

**Tech Stack:** Python 3.14, `mcp` (FastMCP), `feedparser`, `news-please` (fallback: `trafilatura`), pytest, vanilla HTML/CSS/JS, Claude Code scheduled tasks.

**Spec:** `docs/superpowers/specs/2026-07-02-personal-news-agent-design.md`

---

## File Structure

```
newss/
├── .mcp.json                  # registers news-fetcher MCP server
├── feeds.json                 # RSS feed list (editable)
├── profile.md                 # interest profile, read by routine
├── routine.md                 # prompt executed by scheduled task
├── requirements.txt
├── server/
│   ├── __init__.py
│   ├── news_fetcher.py        # FastMCP server entry, tool definitions
│   ├── feeds.py               # RSS fetch, parse, dedupe
│   ├── extractor.py           # article extraction, dual backend
│   └── state/                 # runtime state (gitignored)
│       └── seen_urls.json
├── app/
│   ├── index.html             # news reader UI
│   └── articles.json          # feed data, rewritten each run
└── tests/
    ├── fixtures/
    │   └── sample_rss.xml
    ├── test_feeds.py
    └── test_extractor.py
```

Responsibilities: `feeds.py` never extracts; `extractor.py` never fetches RSS; `news_fetcher.py` only wires tools to those modules. UI never fetches network — reads `articles.json` only.

---

### Task 1: Scaffold + dependencies

**Files:**
- Create: `requirements.txt`, `.gitignore`, `server/__init__.py`

- [ ] **Step 1: Write `requirements.txt`**

```
mcp
feedparser
trafilatura
pytest
```

(news-please installed separately in Step 3 — expected to possibly fail on Python 3.14.)

- [ ] **Step 2: Write `.gitignore`**

```
__pycache__/
server/state/
.pytest_cache/
```

- [ ] **Step 3: Install deps**

Run: `pip install -r requirements.txt`
Expected: success.
Run: `pip install news-please`
Expected: may fail on Python 3.14 (old scrapy/newspaper pins). Record outcome — determines extractor default backend in Task 4. Do NOT fight it more than one retry; trafilatura fallback is the plan.

- [ ] **Step 4: Create `server/__init__.py`** (empty file)

- [ ] **Step 5: Commit**

```bash
git add requirements.txt .gitignore server/__init__.py
git commit -m "chore: scaffold news agent project"
```

---

### Task 2: RSS parsing (`feeds.py` — parse)

**Files:**
- Create: `server/feeds.py`, `tests/test_feeds.py`, `tests/fixtures/sample_rss.xml`

- [ ] **Step 1: Write fixture `tests/fixtures/sample_rss.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Nifty hits record high on IT rally</title>
      <link>https://example.com/nifty-record</link>
      <description>Indian markets surged as IT stocks rallied.</description>
      <pubDate>Wed, 01 Jul 2026 09:30:00 +0530</pubDate>
    </item>
    <item>
      <title>OpenAI releases new model</title>
      <link>https://example.com/openai-model</link>
      <description>New frontier model announced.</description>
      <pubDate>Wed, 01 Jul 2026 08:00:00 +0530</pubDate>
    </item>
  </channel>
</rss>
```

- [ ] **Step 2: Write failing test `tests/test_feeds.py`**

```python
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_feeds.py -v`
Expected: FAIL — `ImportError` / module not found.

- [ ] **Step 4: Implement `server/feeds.py` (parse only)**

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_feeds.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/feeds.py tests/
git commit -m "feat: RSS feed parsing"
```

---

### Task 3: Dedupe + fetch-all (`feeds.py` — state)

**Files:**
- Modify: `server/feeds.py`
- Modify: `tests/test_feeds.py`

- [ ] **Step 1: Write failing tests (append to `tests/test_feeds.py`)**

```python
from server.feeds import filter_new, mark_seen

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
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_feeds.py -v`
Expected: FAIL — `ImportError: cannot import name 'filter_new'`.

- [ ] **Step 3: Implement in `server/feeds.py` (append)**

```python
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


def fetch_all(feeds_config_path: Path) -> list[dict]:
    """Fetch every feed in feeds.json, return fresh (unseen) items, mark them seen."""
    import urllib.request

    config = json.loads(feeds_config_path.read_text(encoding="utf-8"))
    all_items, errors = [], []
    for feed in config["feeds"]:
        try:
            req = urllib.request.Request(
                feed["url"], headers={"User-Agent": "Mozilla/5.0 (news-agent)"}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                content = resp.read()
            all_items.extend(parse_feed(content, source=feed["name"]))
        except Exception as exc:
            errors.append({"feed": feed["name"], "error": str(exc)})
    fresh = filter_new(all_items)
    mark_seen(fresh)
    return {"items": fresh, "errors": errors}
```

Note: `fetch_all` returns a dict — test coverage for it comes from the live smoke test in Task 6 (network-dependent, not unit-tested).

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_feeds.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/feeds.py tests/test_feeds.py
git commit -m "feat: seen-URL dedupe and multi-feed fetch"
```

---

### Task 4: Extraction (`extractor.py`, dual backend)

**Files:**
- Create: `server/extractor.py`, `tests/test_extractor.py`

- [ ] **Step 1: Write failing test `tests/test_extractor.py`**

```python
from server.extractor import extract_from_html

HTML = """
<html><head><title>Nifty hits record</title>
<meta property="og:image" content="https://example.com/img.jpg"></head>
<body><article><h1>Nifty hits record</h1>
<p>Indian equity benchmarks closed at record highs on Wednesday, led by IT and
banking stocks. The Nifty 50 rose 1.2 percent while the Sensex added 900 points.</p>
<p>Analysts said foreign inflows and a stable rupee supported the rally.</p>
</article></body></html>
"""

def test_extract_from_html_returns_text_and_image():
    result = extract_from_html(HTML, url="https://example.com/nifty")
    assert result["url"] == "https://example.com/nifty"
    assert "record highs" in result["text"]
    assert result["error"] is None

def test_extract_from_html_handles_garbage():
    result = extract_from_html("<html></html>", url="https://example.com/empty")
    assert result["error"] is not None or result["text"] == ""
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_extractor.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/extractor.py`**

Backend choice: news-please if it imports (Task 1 Step 3 outcome), else trafilatura. Both wrapped behind one interface.

```python
import json

try:
    from newsplease import NewsPlease
    BACKEND = "newsplease"
except ImportError:
    BACKEND = "trafilatura"

import trafilatura


def _empty(url: str, error: str | None = None) -> dict:
    return {"url": url, "title": "", "text": "", "image_url": "",
            "authors": [], "date": "", "error": error}


def extract_from_html(html: str, url: str) -> dict:
    """Extract article fields from raw HTML. Never raises."""
    try:
        if BACKEND == "newsplease":
            a = NewsPlease.from_html(html, url=url)
            result = _empty(url)
            result.update({
                "title": a.title or "",
                "text": a.maintext or "",
                "image_url": a.image_url or "",
                "authors": a.authors or [],
                "date": a.date_publish.isoformat() if a.date_publish else "",
            })
        else:
            meta = trafilatura.extract_metadata(html)
            text = trafilatura.extract(html, url=url) or ""
            result = _empty(url)
            result.update({
                "title": (meta.title if meta else "") or "",
                "text": text,
                "image_url": (meta.image if meta else "") or "",
                "authors": [meta.author] if meta and meta.author else [],
                "date": (meta.date if meta else "") or "",
            })
        if not result["text"]:
            result["error"] = "no text extracted"
        return result
    except Exception as exc:
        return _empty(url, error=str(exc))


def extract_articles(urls: list[str]) -> list[dict]:
    """Fetch and extract each URL. Per-URL failure isolation."""
    import urllib.request

    results = []
    for url in urls[:30]:
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (news-agent)"}
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            results.append(extract_from_html(html, url))
        except Exception as exc:
            results.append(_empty(url, error=str(exc)))
    return results
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_extractor.py -v`
Expected: PASS. If news-please backend active and `from_html` signature differs, pin behavior with trafilatura by forcing `BACKEND = "trafilatura"` only if news-please genuinely broken — record decision in commit message.

- [ ] **Step 5: Commit**

```bash
git add server/extractor.py tests/test_extractor.py
git commit -m "feat: article extraction with news-please/trafilatura dual backend"
```

---

### Task 5: MCP server (`news_fetcher.py`)

**Files:**
- Create: `server/news_fetcher.py`

- [ ] **Step 1: Implement server**

```python
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from server import feeds, extractor

ROOT = Path(__file__).parent.parent
mcp = FastMCP("news-fetcher")


@mcp.tool()
def fetch_headlines() -> dict:
    """Fetch all configured RSS feeds; return fresh (previously unseen) headline
    items and any per-feed errors. Items: title, url, source, published, summary."""
    return feeds.fetch_all(ROOT / "feeds.json")


@mcp.tool()
def extract_articles(urls: list[str]) -> list[dict]:
    """Extract full article content (title, text, image_url, authors, date) for
    up to 30 URLs. Failed URLs return an 'error' field instead of raising."""
    return extractor.extract_articles(urls)


if __name__ == "__main__":
    mcp.run()
```

- [ ] **Step 2: Smoke test server starts**

Run: `python -c "import sys; sys.path.insert(0, '.'); from server.news_fetcher import mcp; print('tools ok:', mcp.name)"`
Expected: `tools ok: news-fetcher`

Note: server must run with project root on `sys.path` (uses `from server import ...`). `.mcp.json` in Task 7 sets `cwd` to project root and runs `python -m server.news_fetcher`, which handles this.

- [ ] **Step 3: Commit**

```bash
git add server/news_fetcher.py
git commit -m "feat: news-fetcher MCP server with fetch_headlines and extract_articles"
```

---

### Task 6: Feed list + live smoke test

**Files:**
- Create: `feeds.json`

- [ ] **Step 1: Write `feeds.json`**

```json
{
  "feeds": [
    {"name": "ET Markets", "category": "Markets", "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"},
    {"name": "Economic Times", "category": "Business", "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms"},
    {"name": "Mint Markets", "category": "Markets", "url": "https://www.livemint.com/rss/markets"},
    {"name": "MoneyControl", "category": "Business", "url": "https://www.moneycontrol.com/rss/MCtopnews.xml"},
    {"name": "CNBC Top News", "category": "Business", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
    {"name": "BBC World", "category": "World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "Al Jazeera", "category": "Geopolitics", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"name": "Guardian World", "category": "World", "url": "https://www.theguardian.com/world/rss"},
    {"name": "TechCrunch AI", "category": "AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "The Verge AI", "category": "AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"},
    {"name": "Simple Flying", "category": "Aviation", "url": "https://simpleflying.com/feed/"},
    {"name": "Aviation Week", "category": "Aviation", "url": "https://aviationweek.com/rss.xml"}
  ]
}
```

- [ ] **Step 2: Live smoke test**

Run:
```bash
python -c "
import sys; sys.path.insert(0, '.')
from pathlib import Path
from server.feeds import fetch_all
r = fetch_all(Path('feeds.json'))
print('items:', len(r['items']))
print('errors:', r['errors'])
for i in r['items'][:5]: print('-', i['source'], '|', i['title'][:60])
"
```
Expected: items > 50 on first run; errors list mostly empty. **Any feed in errors: find replacement RSS URL for same publisher/category (web search), update feeds.json, re-run until every category has ≥1 working feed.** Delete `server/state/seen_urls.json` between smoke runs to reset dedupe.

- [ ] **Step 3: Commit**

```bash
git add feeds.json
git commit -m "feat: starter RSS feed list, live-verified"
```

---

### Task 7: MCP registration (`.mcp.json`)

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Write `.mcp.json`** (project root; Windows paths)

```json
{
  "mcpServers": {
    "news-fetcher": {
      "command": "python",
      "args": ["-m", "server.news_fetcher"],
      "cwd": "C:\\Users\\jmraw\\OneDrive\\Desktop\\newss"
    }
  }
}
```

- [ ] **Step 2: Verify registration**

Run: `claude mcp list` (from project dir)
Expected: `news-fetcher` listed. If CLI verification unavailable in-session, verification happens at Task 11 E2E run (tools must be callable).

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "feat: register news-fetcher MCP server"
```

---

### Task 8: Profile (`profile.md`)

**Files:**
- Create: `profile.md`

- [ ] **Step 1: Write `profile.md`**

```markdown
# News Interest Profile — Janak

## Priorities (highest first)
1. **Markets / trading-relevant** — anything moving Indian or global markets:
   RBI/Fed decisions, inflation prints, crude oil, rupee, FII flows, earnings,
   sector rallies/crashes, commodity moves. Trading is a primary use — flag
   market-moving items as top stories.
2. **Geopolitics** — conflicts, sanctions, elections, trade deals; especially
   anything with market or India impact.
3. **AI** — all major global updates: new models, big product launches,
   research breakthroughs, chip/compute news, AI policy, funding rounds.
4. **Business (India + global)** — corporate news, deals, policy, economy.
5. **Aviation / airports** — airlines, airport ops, SAF (sustainable aviation
   fuel), Indian aviation sector, hiring/expansion (job-search relevance:
   aviation management roles in India).
6. **World headlines** — major global events.

## Rules
- Prefer India-relevant framing when both exist.
- Dedupe: same event from multiple sources → keep best single item.
- Exclude: celebrity gossip, sports (unless business angle), crypto pump pieces.
- Top stories (max 5): market-moving or globally significant only.
```

- [ ] **Step 2: Commit**

```bash
git add profile.md
git commit -m "feat: interest profile for ranking"
```

---

### Task 9: News app UI (`app/index.html` + seed `articles.json`)

**Files:**
- Create: `app/index.html`, `app/articles.json`

**IMPORTANT:** Before writing the HTML, invoke the `ui-ux-pro-max` skill (installed at user level) with query context "news reader app, editorial, ET/Google News style" and apply its recommended design system (typography: Newsreader/Roboto class pairing; breaking-red accent palette; WCAG AA contrast; no emoji icons; hover states; prefers-reduced-motion). The code below is the required functional baseline — structure, data binding, tabs, dark mode. Visual polish comes from the skill's design system.

- [ ] **Step 1: Seed `app/articles.json`**

```json
{
  "generated_at": "2026-07-02T07:00:00+05:30",
  "edition": "morning",
  "articles": [
    {
      "title": "Sample: Nifty hits record high on IT rally",
      "summary": "Indian equity benchmarks closed at record highs led by IT stocks. Analysts cite foreign inflows and a stable rupee. Watch banking earnings later this week.",
      "category": "Markets",
      "source": "ET Markets",
      "url": "https://example.com/sample",
      "image_url": "",
      "published": "2026-07-02T06:30:00+05:30",
      "top_story": true
    }
  ]
}
```

- [ ] **Step 2: Write `app/index.html`**

Functional baseline (skill-styled version replaces the `<style>` block; keep all IDs, data flow, and JS behavior):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>My News</title>
<style>
  :root {
    --bg: #faf9f7; --fg: #1a1a1a; --muted: #6b6b6b; --card: #ffffff;
    --accent: #dc2626; --border: #e5e2dd; --chip: #f0ede8;
  }
  [data-theme="dark"] {
    --bg: #121212; --fg: #e8e6e3; --muted: #9a9a9a; --card: #1e1e1e;
    --accent: #ef4444; --border: #2c2c2c; --chip: #262626;
  }
  * { margin: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg);
         font-family: Georgia, 'Times New Roman', serif; }
  header { position: sticky; top: 0; background: var(--bg); z-index: 10;
           border-bottom: 1px solid var(--border); padding: 12px 16px; }
  .masthead { display: flex; justify-content: space-between; align-items: center; }
  .masthead h1 { font-size: 1.4rem; }
  .masthead h1 span { color: var(--accent); }
  #edition { font-size: 0.75rem; color: var(--muted);
             font-family: system-ui, sans-serif; }
  #theme-toggle { background: var(--chip); border: 1px solid var(--border);
                  border-radius: 20px; padding: 6px 12px; cursor: pointer;
                  color: var(--fg); font-size: 0.8rem; }
  nav { display: flex; gap: 8px; overflow-x: auto; padding-top: 10px;
        font-family: system-ui, sans-serif; scrollbar-width: none; }
  nav button { background: var(--chip); color: var(--fg); border: none;
               border-radius: 16px; padding: 6px 14px; font-size: 0.85rem;
               cursor: pointer; white-space: nowrap; transition: background 200ms; }
  nav button.active { background: var(--accent); color: #fff; }
  main { max-width: 680px; margin: 0 auto; padding: 16px; }
  .section-label { font-family: system-ui, sans-serif; font-size: 0.75rem;
                   text-transform: uppercase; letter-spacing: 0.08em;
                   color: var(--accent); margin: 12px 0 8px; font-weight: 700; }
  .top-strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
  .top-card { min-width: 260px; max-width: 260px; background: var(--card);
              border: 1px solid var(--border); border-radius: 12px;
              overflow: hidden; cursor: pointer; }
  .top-card img { width: 100%; height: 130px; object-fit: cover; display: block; }
  .top-card .pad { padding: 10px 12px; }
  .top-card h3 { font-size: 0.95rem; line-height: 1.3; }
  .card { background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; margin-bottom: 12px; padding: 14px 16px;
          cursor: pointer; display: flex; gap: 12px; transition: transform 150ms; }
  .card:hover { transform: translateY(-1px); }
  .card img { width: 92px; height: 92px; object-fit: cover;
              border-radius: 8px; flex-shrink: 0; }
  .card h3 { font-size: 1.02rem; line-height: 1.35; margin-bottom: 4px; }
  .meta { font-family: system-ui, sans-serif; font-size: 0.72rem;
          color: var(--muted); margin-bottom: 6px; }
  .meta b { color: var(--accent); font-weight: 600; }
  .summary { font-size: 0.88rem; line-height: 1.5; color: var(--muted);
             display: none; }
  .card.open .summary { display: block; }
  .readlink { font-family: system-ui, sans-serif; font-size: 0.8rem;
              color: var(--accent); text-decoration: none; display: none;
              margin-top: 6px; }
  .card.open .readlink { display: inline-block; }
  .empty { text-align: center; color: var(--muted); padding: 40px 0;
           font-family: system-ui, sans-serif; }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
</style>
</head>
<body>
<header>
  <div class="masthead">
    <h1>My<span>News</span></h1>
    <div>
      <span id="edition"></span>
      <button id="theme-toggle" aria-label="Toggle dark mode">◐</button>
    </div>
  </div>
  <nav id="tabs"></nav>
</header>
<main>
  <div id="top-stories"></div>
  <div id="feed"></div>
</main>
<script>
const CATEGORIES = ["All", "Markets", "Business", "Geopolitics", "AI", "Aviation", "World"];
let DATA = { articles: [] };
let activeTab = "All";

function relTime(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return mins + "m ago";
  if (mins < 1440) return Math.round(mins / 60) + "h ago";
  return Math.round(mins / 1440) + "d ago";
}

function cardHTML(a, cls) {
  const img = a.image_url
    ? `<img src="${a.image_url}" alt="" loading="lazy"
         onerror="this.remove()">` : "";
  return `
    <article class="${cls}" onclick="this.classList.toggle('open')">
      ${cls === "card" ? img : ""}
      <div class="${cls === "top-card" ? "pad" : ""}" style="flex:1">
        ${cls === "top-card" ? img : ""}
        <div class="meta"><b>${a.category}</b> · ${a.source} · ${relTime(a.published)}</div>
        <h3>${a.title}</h3>
        <p class="summary">${a.summary}</p>
        <a class="readlink" href="${a.url}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()">Read original →</a>
      </div>
    </article>`;
}

function render() {
  const top = DATA.articles.filter(a => a.top_story);
  const topEl = document.getElementById("top-stories");
  if (activeTab === "All" && top.length) {
    topEl.innerHTML = `<div class="section-label">Top Stories</div>
      <div class="top-strip">${top.map(a => cardHTML(a, "top-card")).join("")}</div>
      <div class="section-label">Latest</div>`;
  } else { topEl.innerHTML = ""; }

  const list = DATA.articles.filter(a =>
    activeTab === "All" ? !a.top_story : a.category === activeTab);
  document.getElementById("feed").innerHTML = list.length
    ? list.map(a => cardHTML(a, "card")).join("")
    : `<div class="empty">No stories in ${activeTab} this edition.</div>`;
}

function renderTabs() {
  document.getElementById("tabs").innerHTML = CATEGORIES.map(c =>
    `<button class="${c === activeTab ? "active" : ""}"
       onclick="activeTab='${c}';renderTabs();render()">${c}</button>`).join("");
}

document.getElementById("theme-toggle").onclick = () => {
  const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = cur;
  localStorage.setItem("theme", cur);
};
document.documentElement.dataset.theme =
  localStorage.getItem("theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

fetch("articles.json").then(r => r.json()).then(d => {
  DATA = d;
  const dt = new Date(d.generated_at);
  document.getElementById("edition").textContent =
    `${d.edition} edition · ${dt.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`;
  renderTabs(); render();
}).catch(() => {
  document.getElementById("feed").innerHTML =
    `<div class="empty">Could not load articles.json — serve folder:
     <code>python -m http.server 8899</code> in app/ then open
     http://localhost:8899</div>`;
  renderTabs();
});
</script>
</body>
</html>
```

- [ ] **Step 3: Verify UI renders**

Run: `python -m http.server 8899 --directory app` (background), open `http://localhost:8899` in browser (or Claude preview tools).
Expected: masthead, tabs, sample top story renders; dark-mode toggle works; tab switch shows empty-state message for empty categories.

- [ ] **Step 4: Commit**

```bash
git add app/index.html app/articles.json
git commit -m "feat: news reader UI with tabs, top stories, dark mode"
```

---

### Task 10: Routine prompt (`routine.md`)

**Files:**
- Create: `routine.md`

- [ ] **Step 1: Write `routine.md`**

```markdown
# News Digest Routine

You are running the twice-daily news digest for Janak. Work in
`C:\Users\jmraw\OneDrive\Desktop\newss`. Follow exactly:

1. Call MCP tool `news-fetcher / fetch_headlines`.
   - If it errors, retry once. If still failing, STOP — do not overwrite
     `app/articles.json`. Report the error as the task result.
2. Read `profile.md`. Rank all fresh items against it.
3. Select top ~25 items across categories (every category ≥2 items if
   available; Markets gets the most). Same event from multiple sources:
   keep one.
4. Call `news-fetcher / extract_articles` with the selected URLs.
5. For each article, write a 2–3 sentence summary in plain language.
   - Base it on extracted text; if extraction failed for a URL, use the RSS
     summary and keep the item.
   - For Markets items add why it matters for trading (one clause).
6. Tag each: category = one of Markets | Business | Geopolitics | AI |
   Aviation | World; top_story = true for max 5 market-moving or globally
   significant items.
7. Write `app/articles.json` matching the existing schema exactly
   (generated_at = now ISO-8601 with +05:30 offset; edition = "morning" if
   local hour < 12 else "evening").
8. Validate: `python -c "import json; json.load(open('app/articles.json'))"`.
   If invalid, fix before finishing.
9. Final report: one line — item count per category + any feed errors.
```

- [ ] **Step 2: Commit**

```bash
git add routine.md
git commit -m "feat: scheduled digest routine prompt"
```

---

### Task 11: Manual end-to-end run

**Files:** none created — validation task.

- [ ] **Step 1: Restart Claude Code session or reload MCP** so `news-fetcher` tools are live (project `.mcp.json` needs approval on first load).

- [ ] **Step 2: Execute `routine.md` manually** — follow its steps in-session using real MCP tool calls.

Expected: `app/articles.json` rewritten with 20–25 real articles, valid JSON, every category represented.

- [ ] **Step 3: Open UI, verify**

Run: `python -m http.server 8899 --directory app`, open browser.
Check: top stories strip populated, all 6 category tabs show items, images load (some missing OK), summaries expand on tap, "Read original" opens source, dark mode persists on reload.

- [ ] **Step 4: Commit**

```bash
git add app/articles.json
git commit -m "chore: first real digest edition"
```

---

### Task 12: Schedule it

**Files:** none — configuration task.

- [ ] **Step 1: Create scheduled task** via the `schedule` skill / scheduled-tasks MCP:
  - Prompt: `Follow the routine in C:\Users\jmraw\OneDrive\Desktop\newss\routine.md exactly.`
  - Schedule: cron `0 7,19 * * *` (07:00 and 19:00 IST, local machine time), project dir = `C:\Users\jmraw\OneDrive\Desktop\newss`.
  - If the scheduler only supports one time per task, create two tasks (07:00, 19:00).

- [ ] **Step 2: Verify** — list scheduled tasks, confirm both times registered.

- [ ] **Step 3: Tell user:** machine must be on at run times; missed runs skip (morning run sweeps overnight anyway). To read news: open `http://localhost:8899` after starting the tiny server, or double-click a `read-news.bat` if desired later (YAGNI now).

---

## Self-Review

- **Spec coverage:** MCP server (T2–T5, T7), feeds (T6), profile (T8), UI (T9), routine + schedule (T10–T12), error handling (extractor per-URL isolation T4; routine no-overwrite rule T10; feed-down skip T3 `fetch_all`), testing (T2–T4 unit, T6 live smoke, T11 E2E). Covered.
- **Placeholders:** none — all code complete.
- **Type consistency:** `fetch_all` returns `{items, errors}`; routine and smoke test consume that shape. `extract_articles(urls)` list-of-dict with `error` field — matches routine step 5. articles.json schema identical in spec, seed, and routine.
```
