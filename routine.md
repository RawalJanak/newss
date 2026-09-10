# News Digest Routine

You are running the twice-daily news digest for Janak. Work in the `newss/`
folder (relative to the TOMORROW workspace root). Follow exactly:

1. Call MCP tool `news-fetcher / fetch_headlines`.
   - If it errors, retry once. If still failing, STOP — do not overwrite
     `app/articles.json`. Report the error as the task result.
   - Headlines are NOT marked seen yet — a failed run can retry safely.
2. Read `profile.md`. Rank all fresh items against it.
3. Select top ~25 items across categories (every category ≥2 items if
   available; Markets gets the most). Same event from multiple sources:
   keep one. Prefer wire sources (Reuters) + one Indian desk for verification.
4. Call `news-fetcher / extract_articles` with the selected URLs.
5. For each article, write a 2–3 sentence summary in plain language.
   - Base it on extracted text; if extraction failed for a URL, use the RSS
     summary and keep the item.
   - For Markets items add why it matters for trading (one clause).
6. Tag each article:

   **category** — one of: Markets | Economy & Policy | Business | Startups |
   AI | Innovation | Geopolitics | India | Aviation | World

   **top_story** — true for max 5 market-moving or globally significant items

   **confidence** — required on every item:
   - `verified` — two or more independent sources, or a Tier-1 primary (RBI,
     SEBI, exchange filing) plus one outlet
   - `single_sourced` — one outlet only; say so in the write-up
   - `rumour` — unconfirmed talks, grey-market chatter, dealer quotes

   **sources_checked** — array of outlet names used for verification

   **as_of** — when the key fact was true (ISO timestamp or plain text, e.g.
   "2026-08-13 09:40 IST NSE")

   Each article carries BOTH:
   - `summary` — a one-paragraph standfirst (~40 words) used on cards
   - `body` — 500-800 words of ORIGINAL long-form analysis, written in our own
     words: what happened, the hard numbers, the mechanism driving it, what it
     means for an Indian investor, what to watch next. Never reproduce source
     article text verbatim — the site is public and the sources are copyrighted.
     Always link out to the original.

   Target 12-15 fully-written stories per edition. Depth over volume.
7. Archive the current edition: `python scripts/archive_edition.py`
8. Write `app/articles.json` matching the schema (generated_at = now ISO-8601
   with +05:30 offset; edition = "morning" if local hour < 12 else "evening").
9. Validate: `python scripts/validate_articles.py`
   If invalid, fix before finishing.
10. Mark headlines consumed: `news-fetcher / confirm_seen` with every URL used
    from step 1's fetch (selected or not — all fresh URLs from that fetch).
11. Publish to phone: `git add app/articles.json archive/`, commit with message
    `chore: digest edition <date> <morning|evening>`, then `git push origin master`.
    If push fails (offline/auth), continue — local app still updated; note the
    failure in the report.
12. Final report: one line — item count per category + confidence breakdown +
    any feed errors + push status.

## Frontend build (from 5 Sep 2026)

`app/` is a **build output** now, not hand-edited HTML — the source lives in
`webapp/` (React + Vite, plain CSS, no 3D — a labeled card feed after the
constellation redesign was reverted for being unreadable at real content
volume). Step 8 above still writes
`app/articles.json` directly (data pipeline unchanged, untouched by the
frontend). Only rebuild the UI when `webapp/src/**` changes:

```
cd webapp && npm run build   # writes ../app/index.html + assets, in place
```

`vite.config.js` uses `emptyOutDir:false` so this never touches
`articles.json` / `markets.json`. Don't hand-edit `app/index.html` or
`app/assets/` — edit `webapp/src/` and rebuild.

## Three-tier output (from 4 Sep 2026)

Each edition writes three tiers into `app/articles.json`.

| Tier | Key | Count | Treatment |
|---|---|---|---|
| Deep | `articles` | 15–20 | 600–700 words, Tier 1–4 verification, hand-authored `exam` block |
| Brief | `briefs` | 40–60 | 1–2 dated sentences, hand-authored `exam` block |
| Wire | `wire` | 200–400 | Mechanical capture, `server.exam.build_wire_exam()` |

**Wire is built, not written.** After selection, pass every remaining fresh item
through `build_wire_exam(title)` and emit `{title, source, url, published,
category, exam}`. Never hand-write wire copy.

**Briefs come from last edition's promotions.** Wire items carrying
`exam.promote == true` are the candidate pool. Scan those first; only look wider
if the pool is thin.

**Exam blocks on deep and brief items are hand-authored** while writing the text —
the sources are already open. Categories must be copied verbatim from
`AAI/GK_CURRICULUM.md`; the validator rejects anything else. Every fact needs
`kind` from the closed taxonomy and an `as_of` date.

Nothing in this routine writes to `AAI/QUESTION_BANK.md`. That is Phase 2.

## MANDATED verification protocol (added 12 Aug 2026 — applies to every brief and digest)

No item is reported as fact until it clears these tiers. Never relay a headline unchecked.

- **Tier 1 — primary source first.** BSE/NSE corporate announcements, RBI press releases,
  SEBI circulars, company statements. A filing outranks any news outlet.
- **Tier 2 — two independent outlets.** Preferably one wire (Reuters) plus one
  Indian desk. A single outlet is not verification.
- **Tier 3 — timestamp everything.** Nothing enters a brief without a "when". Intraday market
  levels must carry the time they were quoted; markets move between sources.
- **Tier 4 — label confidence explicitly** on every item via the `confidence` field:
  - `verified` — two or more independent sources
  - `single_sourced` — stated as such
  - `rumour` — unconfirmed / grey-market chatter
- **Never present IPO GMP (grey market premium) as data.** It is an unregulated, unverifiable
  dealer-quoted number. If included at all, use `confidence: "rumour"`.
- **Resolve contradictions, don't average them.** If two sources disagree on a market level,
  it is usually a timing difference — report the movement and both timestamps.
- **LLM consensus is not verification.** Tools that poll multiple AI models (e.g. eye2.ai)
  measure agreement between models trained on overlapping data, and are blind to anything
  newer than their cutoffs. Useful for interpretation questions, never for establishing facts.

## articles.json schema (per article)

```json
{
  "title": "",
  "summary": "",
  "body": "",
  "category": "Markets",
  "source": "",
  "url": "",
  "image_url": "",
  "published": "ISO-8601",
  "top_story": false,
  "confidence": "verified",
  "sources_checked": ["Reuters Business", "ET Markets"],
  "as_of": "2026-08-13 09:40 IST",
  "read_min": 2,
  "words": 500
}
```
