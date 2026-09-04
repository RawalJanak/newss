# newss — full-breadth coverage and AAI exam layer

*Design doc · 4 September 2026 · revision 2 · Phase 1 of 3*

> **Revision 2** replaces the 20-articles-plus-10-briefs model with a three-tier
> content model after the requirement changed to "mine more, cover more, all news".
> The PIB open item from revision 1 is resolved.

## Problem

Three problems, one cause.

1. **The reader page wastes its sides.** After the 4 September responsive work the
   article column is capped at an 820px reading measure inside a 1200px shell. On a
   laptop that leaves ~380px of empty gutter on every article.
2. **The portal covers markets and misses the exam.** Janak is sitting AAI Junior
   Executive (Operations), Advt 12/2026. Part A is 50% of a 120-mark paper and includes
   General Knowledge. `AAI/GK_CURRICULUM.md` lists Sports, Awards & Honours, Books &
   Authors, Arts & Culture, Economy & Banking bodies and two Current-affairs rows as
   live study categories. The digest produces none of them.
3. **The pipeline discards almost everything it fetches.** The 4 September run pulled
   2,076 fresh items, 1,037 of them from the last 26 hours, and published 20.
   **Roughly 98% of recent news is fetched, ranked, and thrown away.**

The cause is the same: the digest was scoped to a small number of deeply-written market
stories, so both the layout and the content stop far short of what is available.

## Goal

Cover the news broadly — everything the feeds return, not a curated twentieth of it —
and extract from it the facts AAI could ask about. Put those facts in the empty gutter.

## Non-goals for Phase 1

- Writing to `AAI/QUESTION_BANK.md`. That is Phase 2 and runs behind human review.
- X, Instagram, reels, trending video. That is Phase 3.
- Changing how *deep* article bodies are written or verified. The mandated Tier 1–4
  verification protocol in `routine.md` is unchanged for that tier.

## Design

### 1. Three-tier content model

The binding constraint is not fetching, ranking or payload — it is that every published
story is currently hand-written. That does not scale to "all news", so coverage is
tiered by how much writing each item receives.

| Tier | Volume/edition | Treatment | Cost |
|---|---|---|---|
| **Deep** | 15–20 | 600–700 word original analysis, multi-source verification, full hand-authored `exam` block | High — the existing routine |
| **Brief** | 40–60 | One or two dated, fact-dense sentences, hand-authored `exam` block | Moderate |
| **Wire** | 200–400 | Mechanical capture: title, source, timestamp, category, link, image. **No hand-writing.** Auto-tagged | Near zero |

Wire is where "all news" actually lives. It is a filter-plus-dedupe pass over what
`server/feeds.py` already returns, so its marginal cost is payload, not build time. It
is the tier that stops the 98% discard.

Deep drops from 20 to 15–20 to fund the larger brief tier. Total published items per
edition rises from 20 to roughly **300–450**.

### 2. Feed expansion

`feeds.json` currently holds 60 feeds, heavily skewed: Business 16, Analysis 14,
Markets 6, and **zero** sports, entertainment, science, health or education.

**Verified reachable, 4 September 2026:**

| Feed | Entries | Lane |
|---|---|---|
| ESPNcricinfo | 100 | Sports |
| The Hindu Sport | 60 | Sports |
| Times of India Sports | 20 | Sports |
| Times of India Entertainment | 20 | Entertainment |
| The Hindu Sci-Tech | 60 | Science |
| The Hindu Education | 60 | Education |
| The Hindu National | 60 | India |
| Google News — `site:pib.gov.in` | 100 | Government |
| Google News — appointments | 100 | Exam / appointments |
| Google News — awards | 100 | Exam / awards |

**PIB is resolved.** Revision 1 flagged PIB RSS as an open item after its documented
endpoints returned zero. The Google News proxy (`news.google.com/rss/search?q=site:pib.gov.in`)
returns 100 entries and ships as the Government lane. No spike needed.

**Exam-category query feeds — the significant addition.** Google News RSS accepts an
arbitrary query, so a feed can be constructed per AAI GK curriculum row. The
appointments query's first result during testing was *"Ashok Kumar Lahiri Appointed NITI
Aayog Vice…"* — a textbook AAI current-affairs fact, surfaced by a feed built for that
purpose. Query feeds to add, one per targeted curriculum row:

`appointments · awards · government schemes · summits and MoUs · defence exercises ·
obituaries · indices and rankings · sports championships · books and authors`

These serve breadth and the exam goal through the same mechanism, which is why they are
worth more than a generic feed count increase.

Olympics.com RSS timed out during testing and is excluded pending a retry. It is not
load-bearing — cricket, general sport and the championships query cover the category.

### 3. The `exam` block

Deep and Brief items carry a hand-authored `exam` object, written during the same pass
that writes the text.

```json
"exam": {
  "relevance": "high",
  "categories": ["Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.)"],
  "facts": [
    { "fact": "Gyanesh Kumar is the Chief Election Commissioner",
      "kind": "officeholder", "as_of": "2026-09-04" }
  ],
  "drill": {
    "q": "Who is the Chief Election Commissioner of India?",
    "options": ["Rajiv Kumar", "Gyanesh Kumar", "Sushil Chandra", "Anup Chandra Pandey"],
    "answer": 2
  }
}
```

**`relevance`** — `high` · `medium` · `none` for hand-authored tiers; `unscored` for
Wire. Most market stories are `none`, and that is correct.

**`categories`** — must use the exact row labels from `AAI/GK_CURRICULUM.md`. Verbatim
copying is what lets the two repos be joined without a mapping table. A story fitting no
existing row is a signal the curriculum needs a new row, not licence to invent a label.

**`facts[].kind`** — closed taxonomy:
`officeholder` · `date` · `number` · `award` · `scheme` · `record` · `place` ·
`book` · `obituary` · `body`

Closed so facts can later be drilled by type; "name the officeholder" is a different
exercise from "recall the number".

**`facts[].as_of`** — mandatory. Current affairs decay, and `AAI/QUESTION_BANK.md`
already models this with `Status: current | stale: <what changed>`. Dating every fact is
what makes staleness detectable in Phase 2 rather than silently wrong.

**`drill`** — optional, only when `relevance` is `high`. Four options, `answer`
1-indexed, matching the `QUESTION_BANK.md` convention exactly so Phase 2 needs no
format translation.

### 4. Wire tier: auto-tagging and promotion

Wire items are not hand-read, so they carry a reduced block:

```json
"exam": { "relevance": "unscored", "categories": ["Sports — records, terminology, tournaments"],
          "facts": [], "drill": null, "promote": true }
```

`categories` is assigned by keyword match against curriculum row labels. `promote` is
set when the headline matches exam-signal patterns — *appointed · sworn in · wins award ·
launches scheme · sets record · dies · ranked · summit · signs MoU · inaugurates*.

**The promotion path is the point.** Flagged wire items become the candidate pool for
the next edition's Brief tier. Rather than hand-scanning 2,000 headlines for exam value,
the pipeline surfaces the few hundred that look examinable and those get hand-written.
The wire tier therefore does double duty: it is the coverage, and it is the funnel.

Auto-tagging is explicitly lower quality than hand-authoring. Wire items are labelled as
such in the UI and are never eligible for Phase 2's question bank without first being
promoted to Brief and hand-verified.

### 5. Reader rail

At `min-width: 1180px`, `.art` becomes a two-column grid:

```css
.art { display:grid; grid-template-columns:820px minmax(300px,1fr); gap:40px; align-items:start; }
.art > .lead, .art > h1, .art > .byline, .art > .simple,
.art > .nums, .art > .gloss, .art > .full, .art > .verify { grid-column:1; }
.examrail { grid-column:2; position:sticky; top:72px; }
```

The rail renders `exam.facts` as labelled chips grouped by `kind`, with `drill`
collapsed beneath. Articles with `relevance: none` render no rail and the grid collapses
to a single centred column, so those pages look deliberate rather than broken.

Below 1180px the rail reflows inline beneath the article body rather than hiding. The
exam layer is the point of the feature; hiding it on the device he actually reads on
would defeat it.

### 6. Home layout at 300–450 items

The current home view — hero, six-card rail, then every remaining story as a card — does
not survive a 400-item feed. Home becomes:

- **Lead + Also important** — Deep tier, unchanged
- **Briefs** — compact dated list, grouped by category, exam-flagged items marked
- **The wire** — collapsed by default, virtualised list, filterable by category, with
  a persistent count ("312 more stories today")

Wire is opt-in rather than an endless scroll, so breadth is available without the front
page becoming unusable.

### 7. Validation

`scripts/validate_articles.py` extends. It already runs each edition and is the
regression guard.

| Rule | Current | New |
|---|---|---|
| deep article count | 10–20 | 12–25 |
| `briefs[]` | — | 20–80; each needs `text`, `category`, `date`, `source`, `url`, `exam` |
| `wire[]` | — | 0–600; each needs `title`, `source`, `url`, `published`, `category`, `exam` |
| `exam` present on every item, all tiers | — | required |
| `exam.relevance` | — | `high`/`medium`/`none`, or `unscored` for wire only |
| `exam.facts[]` shape | — | `fact`, `kind`, `as_of` all required |
| `exam.facts[].kind` | — | must be in the closed taxonomy |
| `exam.categories[]` | — | must match a row label in `GK_CURRICULUM.md` |
| `drill` when `relevance: high` | — | 4 options, `answer` in 1–4 |
| wire items | — | must NOT carry `facts` or `drill` |
| duplicate URLs across tiers | — | rejected |

The `categories` check reads `AAI/GK_CURRICULUM.md` at validation time. If absent — a
clone of `newss` alone — it degrades to a warning rather than failing, so the digest
stays independently buildable.

## Data flow

```
feeds.json (60 → ~80 feeds, incl. exam-category query feeds)
        │
        ▼
server/feeds.py ──► ~2,000 fresh items
        │
        ├─────────────► WIRE tier ──── auto-tag + promote flag ────┐
        │                (200-400, mechanical)                      │
        │                                                           │
        ├─────────────► BRIEF tier ─── hand-written, exam block ────┤
        │                (40-60, fed by last edition's promotions)  │
        │                                                           │
        └─────────────► DEEP tier ──── existing routine + exam ─────┤
                         (15-20, full verification)                 │
                                                                    ▼
                                                          app/articles.json
                                                                    │
                                              ┌─────────────────────┴────────┐
                                              ▼                              ▼
                                    home: lead / briefs / wire        reader + exam rail
```

Phase 2 adds one consumer: a review queue drafting `QUESTION_BANK.md` entries from
Deep and Brief facts only. Nothing in Phase 1 writes outside the `newss` repo.

## Payload

`app/articles.json` is currently 155KB for 20 deep articles. Estimated after expansion:

| Tier | Count | Approx each | Total |
|---|---:|---:|---:|
| Deep | 20 | 7KB | 140KB |
| Brief | 60 | 600B | 36KB |
| Wire | 400 | 250B | 100KB |
| | | | **~280KB** |

Well within budget for a static site. The wire tier is cheap precisely because it stores
no prose. If it ever exceeds ~1.5MB, split `wire[]` into its own lazily-fetched file —
not pre-optimised.

## Testing

- `scripts/validate_articles.py` covers every rule in §7 and runs each edition.
- Layout verified in a real browser at 390px, 1079px and 1600px plus the reader view, as
  was done for the 4 September responsive change. Specifically: an article with
  `relevance: none` must render as a single centred column; the rail must appear inline
  below the body at 390px; the wire list must stay responsive with 400 items loaded.
- Unit test for the `categories`-against-curriculum check with a fixture curriculum
  file, including the degraded-to-warning path when absent.
- Unit test for the wire promotion matcher against a fixture headline set — it must flag
  "X appointed as Y" and must not flag routine market headlines.

## Risks

| Risk | Handling |
|---|---|
| Build time per edition grows | Deep drops to 15–20; Brief is short-form; Wire is mechanical. Wire promotion means brief selection is pre-filtered rather than hand-scanned |
| Auto-tagged wire categories are wrong | Wire is labelled lower-confidence in UI and barred from Phase 2 until promoted and hand-verified |
| 400-item home page becomes unusable | Wire collapsed by default, virtualised, category-filtered (§6) |
| Google News query feeds change format or rate-limit | They are additive; the lane degrades to fewer items rather than breaking the build |
| Duplicate stories across 80 feeds | Validator rejects duplicate URLs across tiers; existing dedupe in the selection pass extends to wire |
| Payload growth | Measured at ~280KB against a 155KB baseline; split `wire[]` only if it exceeds ~1.5MB |

## Sequencing

**Phase 1** (this spec) — feed expansion, three-tier model, `exam` block, wire
auto-tag and promotion, reader rail, home restructure, validation.
**Phase 2** — review queue writing to `AAI/QUESTION_BANK.md` in its exact `###` format,
behind explicit approval, sourced from Deep and Brief facts only.
**Phase 3** — buzz layer. X first (OpenCLI session verified live 4 September 2026), then
an Instagram curated-account watchlist and trending video after a spike. Last: most
fragile, lowest exam yield, and the only part touching personal accounts.
