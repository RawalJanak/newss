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
9. Publish to phone: `git add app/articles.json`, commit with message
   `chore: digest edition <date> <morning|evening>`, then `git push origin master`.
   If push fails (offline/auth), continue — local app still updated; note the
   failure in the report.
10. Final report: one line — item count per category + any feed errors + push status.
