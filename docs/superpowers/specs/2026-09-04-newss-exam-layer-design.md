# newss — breadth expansion and AAI exam layer

*Design doc · 4 September 2026 · Phase 1 of 3*

## Problem

Two problems, one cause.

1. **The reader page wastes its sides.** After the 4 September responsive work the
   article column is capped at an 820px reading measure inside a 1200px shell. On a
   laptop that leaves ~380px of empty gutter on every article.
2. **The portal covers markets and misses the exam.** Janak is sitting AAI Junior
   Executive (Operations), Advt 12/2026. Part A is 50% of a 120-mark paper and includes
   General Knowledge. `AAI/GK_CURRICULUM.md` lists Sports, Awards & Honours, Books &
   Authors, Arts & Culture, Economy & Banking bodies and two Current-affairs rows as
   live study categories. The digest currently produces none of them, and the current
   affairs it *does* produce are not captured in a form the study repo can use.

The cause is the same: the digest was scoped to markets, so both the layout and the
content stop short of what the reader needs.

## Goal

Cover current affairs broadly — including sports and entertainment — and extract, from
every story, the facts that AAI could actually ask about. Put those facts in the empty
gutter.

Phase 1 delivers coverage, extraction and display. It deliberately does not write to the
study repo and does not touch social platforms.

## Non-goals for Phase 1

- Writing to `AAI/QUESTION_BANK.md`. That is Phase 2 and runs behind human review.
- X, Instagram, reels, trending video. That is Phase 3.
- Changing how article bodies are written, ranked or verified. The existing routine in
  `routine.md`, including the mandated Tier 1–4 verification protocol, is unchanged.

## Design

### 1. Sources

`feeds.json` gains a sports lane, an entertainment lane and an appointments/schemes lane.

Verified reachable on 4 September 2026:

| Feed | Entries returned |
|---|---|
| ESPNcricinfo | 100 |
| Times of India Sports | 20 |
| The Hindu Sport | 60 |
| Times of India Entertainment | 20 |

**Open item — PIB.** The Press Information Bureau is the primary source for Indian
government appointments, schemes and awards, and is therefore the single highest-value
feed for AAI current affairs. Its documented RSS endpoints
(`pib.gov.in/RssMain.aspx?ModId=6&...`) returned zero entries when tested on
4 September 2026. Phase 1 implementation begins with a timeboxed spike: try the
Google News RSS workaround (`news.google.com/rss/search?q=site:pib.gov.in&hl=en-IN`),
and if that fails, fall back to the existing `Google News IN Nation` feed with
PIB-oriented ranking. The lane ships either way; only its source is uncertain.

Aviation, RBI Press Releases and SEBI Updates already exist in `feeds.json` and already
serve Tier 1 exam categories. They need no change.

### 2. The `exam` block

Every article in `app/articles.json` gains an `exam` object. It is authored during the
same pass that writes the article body — the sources are already being read and
cross-checked, so extraction adds judgement, not a second pipeline.

```json
"exam": {
  "relevance": "high",
  "categories": ["Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.)"],
  "facts": [
    {
      "fact": "Gyanesh Kumar is the Chief Election Commissioner",
      "kind": "officeholder",
      "as_of": "2026-09-04"
    }
  ],
  "drill": {
    "q": "Who is the Chief Election Commissioner of India?",
    "options": ["Rajiv Kumar", "Gyanesh Kumar", "Sushil Chandra", "Anup Chandra Pandey"],
    "answer": 2
  }
}
```

**`relevance`** — `high` · `medium` · `none`. Most market stories will be `none`, and
that is correct. `none` articles still carry the block with an empty `facts` array so
the schema stays uniform and the validator can be strict.

**`categories`** — must use the exact row labels from `AAI/GK_CURRICULUM.md`. Copying
the labels verbatim is what allows the study repo and the digest to be joined later
without a mapping table. If a story fits no existing curriculum row, that is a signal
the curriculum needs a new row, not that the label should be invented here.

**`facts[].kind`** — a closed taxonomy:

`officeholder` · `date` · `number` · `award` · `scheme` · `record` · `place` ·
`book` · `obituary` · `body` (institutions, their heads and mandates)

The taxonomy exists so facts can later be drilled by type — "name the officeholder" is a
different exercise from "recall the number". An open string field would not support that.

**`facts[].as_of`** — mandatory. Current affairs decay, and
`AAI/QUESTION_BANK.md` already models this with its `Status: current | stale: <what
changed>` field. Stamping every fact with a date is what makes staleness detectable in
Phase 2 rather than silently wrong.

**`drill`** — optional, and only when `relevance` is `high`. Four options, `answer` is
the 1-indexed option number, matching the existing `QUESTION_BANK.md` convention exactly
so Phase 2 needs no format translation.

### 3. Briefs

A new top-level array in `app/articles.json`:

```json
"briefs": [
  {
    "text": "India beat Australia by 6 wickets in the third ODI at Rajkot to take the series 2-1.",
    "category": "Sports",
    "date": "2026-09-04",
    "source": "ESPNcricinfo",
    "url": "https://...",
    "exam": { "relevance": "high", "categories": ["Sports — records, terminology, tournaments"],
              "facts": [ ... ], "drill": null }
  }
]
```

Briefs are one or two dated, fact-dense sentences. They exist because a sports result or
an appointment is a fact, not an essay — forcing it into a 650-word slot would waste the
build and bury the fact. Sports results, awards, appointments and obituaries belong here
unless the story genuinely warrants full treatment.

Target volume per edition: **20 full articles + ~10 briefs**.

### 4. Reader rail

At `min-width: 1180px`, `.art` becomes a two-column grid:

```css
.art { display:grid; grid-template-columns:820px minmax(300px,1fr); gap:40px; align-items:start; }
.art > .lead, .art > h1, .art > .byline, .art > .simple,
.art > .nums, .art > .gloss, .art > .full, .art > .verify { grid-column:1; }
.examrail { grid-column:2; position:sticky; top:72px; }
```

The rail renders `exam.facts` as labelled chips grouped by `kind`, with the `drill`
question collapsed beneath them. Articles with `relevance: none` render no rail, and the
grid collapses to a single centred column so those pages look deliberate rather than
broken.

Below 1180px the rail is not hidden — it reflows inline beneath the article body. Mobile
gains the exam facts and loses nothing. This matters: the exam layer is the point of the
feature, and hiding it on the device he actually reads on would defeat it.

### 5. Validation

`scripts/validate_articles.py` extends. It already runs on every edition and is the
regression guard.

| Rule | Current | New |
|---|---|---|
| article count | 10–20 | 10–30 |
| `exam` present on every article | — | required |
| `exam.relevance` | — | one of `high`/`medium`/`none` |
| `exam.facts[]` shape | — | `fact`, `kind`, `as_of` all required |
| `exam.facts[].kind` | — | must be in the closed taxonomy |
| `exam.categories[]` | — | must match a row label in `GK_CURRICULUM.md` |
| `drill` when `relevance: high` | — | 4 options, `answer` in 1–4 |
| `briefs[]` | — | 0–15; each needs `text`, `category`, `date`, `source`, `url`, `exam` |

The `categories` check reads `AAI/GK_CURRICULUM.md` at validation time. If that file is
not present — someone clones `newss` alone — the check degrades to a warning rather than
failing the build, so the digest stays independently buildable.

## Data flow

```
feeds.json ──► server/feeds.py ──► fresh headlines
                                        │
                                        ▼
                            selection + extraction (existing)
                                        │
                                        ▼
                     ┌──── article body (existing routine) ────┐
                     │                                          │
                     └──── exam block (new, same pass) ─────────┘
                                        │
                                        ▼
                              app/articles.json
                                   │        │
                        ┌──────────┘        └──────────┐
                        ▼                              ▼
                 home + briefs                   reader + exam rail
```

Phase 2 will add one consumer of `articles.json` — a review queue that drafts
`QUESTION_BANK.md` entries. Nothing in Phase 1 writes outside the `newss` repo.

## Testing

- `scripts/validate_articles.py` covers the schema rules in §5 and runs each edition.
- Layout is verified in a real browser at 390px, 1079px and 1600px, plus the reader
  view, as was done for the 4 September responsive change. Specifically: an article with
  `relevance: none` must render as a single centred column, and the rail must appear
  inline below the body at 390px.
- The `categories`-against-curriculum check gets a unit test with a fixture curriculum
  file, including the degraded-to-warning path when the file is absent.

## Risks

| Risk | Handling |
|---|---|
| PIB RSS unavailable | Timeboxed spike with two named fallbacks; the lane ships regardless (§1) |
| Payload growth — 30 items plus exam blocks | Measure `articles.json` after the first full edition; if it exceeds ~1.5MB, split briefs into their own file. Not pre-optimised. |
| Exam facts drift stale | Every fact carries `as_of`; Phase 2 uses it to flag decay against `Status:` |
| Curriculum labels drift from digest labels | Validator fails the build on unknown labels, so drift is caught at build time |
| Extraction quality is subjective | Phase 2 gates every fact behind human review before it reaches the study repo |

## Sequencing

**Phase 1** (this spec) — sources, `exam` block, briefs, rail, validation.
**Phase 2** — review queue writing to `AAI/QUESTION_BANK.md` in its exact `###` format,
behind explicit approval. Ships only once Phase 1 extraction is proven in daily use.
**Phase 3** — buzz layer. X first (OpenCLI session verified live on 4 September 2026),
then an Instagram curated-account watchlist and trending video after a spike. Last,
because it is the most fragile, the lowest exam yield, and the only part that touches
personal accounts.
