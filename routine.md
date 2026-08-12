# News Digest Routine

You are running the twice-daily news digest for Janak. Work in
`C:\Users\jmraw\OneDrive\Desktop\TOMORROW\newss`. Follow exactly:

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
9. Publish to phone: `git add app/articles.json`, commit with message
   `chore: digest edition <date> <morning|evening>`, then `git push origin master`.
   If push fails (offline/auth), continue — local app still updated; note the
   failure in the report.
10. Final report: one line — item count per category + any feed errors + push status.

## MANDATED verification protocol (added 12 Aug 2026 — applies to every brief and digest)

No item is reported as fact until it clears these tiers. Never relay a headline unchecked.

- **Tier 1 — primary source first.** BSE/NSE corporate announcements, RBI press releases,
  SEBI circulars, company statements. A filing outranks any news outlet.
- **Tier 2 — two independent outlets.** Preferably one wire (Bloomberg/Reuters) plus one
  Indian desk. A single outlet is not verification.
- **Tier 3 — timestamp everything.** Nothing enters a brief without a "when". Intraday market
  levels must carry the time they were quoted; markets move between sources.
- **Tier 4 — label confidence explicitly** on every item:
  - ✅ verified against two or more independent sources
  - ⚠️ single-sourced — stated as such
  - 🔵 rumour / unconfirmed / grey-market chatter
- **Never present IPO GMP (grey market premium) as data.** It is an unregulated, unverifiable
  dealer-quoted number. If included at all, it carries 🔵.
- **Resolve contradictions, don't average them.** If two sources disagree on a market level,
  it is usually a timing difference — report the movement and both timestamps.
- **LLM consensus is not verification.** Tools that poll multiple AI models (e.g. eye2.ai)
  measure agreement between models trained on overlapping data, and are blind to anything
  newer than their cutoffs. Useful for interpretation questions, never for establishing facts.
