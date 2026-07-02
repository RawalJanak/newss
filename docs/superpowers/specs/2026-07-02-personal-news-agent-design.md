# Personal News Agent — Design Spec

**Date:** 2026-07-02
**Owner:** Janak M Rawal
**Location:** `C:\Users\jmraw\OneDrive\Desktop\newss`

## Purpose

Twice-daily personalized news agent. Scrapes global news via RSS + news-please,
ranks against a personal interest profile, and renders an app-style news feed
(Economic Times / Google News UX) as a local HTML page.

**Reader goals:** trading-relevant market news, business, geopolitics, AI
developments, aviation/airport industry, world headlines.

## Architecture

```
RSS feeds ──> news-fetcher MCP server (Python, stdio, local)
                      │
                      v
        Claude Code scheduled routine (7:00 + 19:00 IST)
                      │  rank → extract → summarize
                      v
              articles.json ──> index.html (news app UI)
```

Three components, each independently testable:

### 1. news-fetcher MCP server

Python MCP server (stdio transport), registered in project `.mcp.json`.

**Tools:**

| Tool | Input | Output |
|------|-------|--------|
| `fetch_headlines()` | none | Fresh RSS items since last run: `{title, url, source, published, summary}` |
| `extract_articles(urls: list)` | up to ~30 URLs | Per URL: `{title, text, image_url, authors, date, url}` or `{url, error}` |

**Internals:**
- Feed list in `feeds.json` (editable, ~12–15 feeds at start).
- Dedupe: `seen_urls.json` store; URLs older than 7 days pruned.
- Extraction: news-please `NewsPlease.from_urls()`.
- **Fallback:** if news-please fails to install/run on Python 3.14, swap the
  extractor module to `trafilatura`. Tool interface unchanged; only the
  internal `extractor.py` module changes.
- Per-URL failure isolation: one bad article returns `{url, error}`, never
  crashes the batch. Routine falls back to the RSS summary text for failed URLs.

### 2. Scheduled routine

Claude Code scheduled task, twice daily (07:00 and 19:00 local). Runs on this
PC — machine must be on; a missed run is skipped (next run covers it, since
morning run always sweeps overnight news).

**Routine prompt steps:**
1. Call `fetch_headlines()`.
2. Rank items against `profile.md` (interest weights; market-moving news
   highest priority).
3. Pick top ~25; call `extract_articles(urls)`.
4. Summarize each in 2–3 sentences; tag category
   (Markets | Business | Geopolitics | AI | Aviation | World) and
   importance (top-story flag).
5. Write `articles.json` (schema below). Do not touch `index.html`.

**articles.json schema:**
```json
{
  "generated_at": "ISO-8601",
  "edition": "morning | evening",
  "articles": [
    {
      "title": "", "summary": "", "category": "Markets",
      "source": "", "url": "", "image_url": "",
      "published": "ISO-8601", "top_story": false
    }
  ]
}
```

### 3. News app UI

Single static `index.html` (vanilla HTML/CSS/JS, no build step) that fetches
`articles.json` at load.

- **Layout:** ET/Google News style — top stories horizontal strip, then
  category tab bar (Markets | Business | Geopolitics | AI | Aviation | World),
  card list per tab.
- **Card:** image (placeholder if none), headline, source + relative time,
  2–3 line summary. Tap → expands summary + "Read original" link.
- **Dark mode:** follows system preference, manual toggle persisted in
  localStorage.
- Shows `generated_at` ("Morning edition · updated 7:02 AM") in header.
- Opened via `file://` or tiny `python -m http.server` shortcut if `fetch()`
  of local JSON is blocked by browser.

## Personalization

`profile.md` — plain-markdown interest profile: topics, weights, preferred
sources, exclusions. The routine prompt reads it every run. User updates it
conversationally ("more SAF news, less crypto") — agent edits the file.

Starter profile: markets/trading (highest), business, geopolitics, AI
(global, all major model/product/research updates), aviation/airports/SAF
(job-search relevance), world headlines.

## Starter feed list

ET Markets, Economic Times, Mint, MoneyControl, Reuters Business, Reuters
World, BBC World, Al Jazeera, TechCrunch AI, The Verge AI, Aviation Week,
Simple Flying. (Exact RSS URLs resolved during implementation; any dead feed
replaced with equivalent.)

## Error handling

- Feed down → skip feed, log, continue.
- Extraction failure → use RSS summary text, mark card "summary from feed".
- Empty fetch (no new items) → keep previous `articles.json`, note in log.
- MCP server crash → scheduled run reports failure visibly (Claude Code task
  output), does not overwrite last good `articles.json`.

## Testing

1. Unit-test fetcher: parse fixture RSS, dedupe logic.
2. Manual: run both MCP tools against live feeds, verify output shape.
3. One full manual digest run end-to-end; open UI, verify all tabs, dark mode,
   links.
4. Only then create the scheduled task.

## Out of scope (YAGNI)

- No database (JSON files suffice).
- No push notifications, no email.
- No historical archive beyond last edition (may add later).
- No paywalled-content workarounds.
