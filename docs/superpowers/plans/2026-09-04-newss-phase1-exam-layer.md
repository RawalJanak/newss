# newss Phase 1 — Full-Breadth Coverage and AAI Exam Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish 300–450 items per edition across three tiers instead of 20, and attach an AAI-exam fact layer to every item, rendered in the reader's empty right gutter.

**Architecture:** A new `server/exam.py` module owns the exam taxonomy, curriculum-label loading, and wire auto-tagging. `feeds.json` gains sports, entertainment, science, education, government and per-curriculum-row query lanes. `scripts/validate_articles.py` grows from one-tier to three-tier validation. `app/index.html` gains a sticky exam rail on the reader and a collapsed wire list on home. No file outside the `newss` repo is written.

**Tech Stack:** Python 3.14, `feedparser`, `pytest` (testpaths=`tests`, pythonpath=`.`), vanilla HTML/CSS/JS in a single self-contained `app/index.html`.

**Spec:** `docs/superpowers/specs/2026-09-04-newss-exam-layer-design.md`

## Global Constraints

- `exam.categories[]` entries MUST match a row label in `AAI/GK_CURRICULUM.md` **verbatim**. Never invent a label.
- `exam.facts[].kind` MUST be one of: `officeholder` `date` `number` `award` `scheme` `record` `place` `book` `obituary` `body`.
- `exam.facts[].as_of` is mandatory on every fact.
- `exam.relevance` is `high` | `medium` | `none` for deep/brief; `unscored` for wire only.
- `exam.drill` is present only when `relevance == "high"`; exactly 4 options; `answer` is 1-indexed (1–4), matching `AAI/QUESTION_BANK.md`.
- Wire items MUST NOT carry `facts` or `drill`.
- If `AAI/GK_CURRICULUM.md` is absent, the curriculum check degrades to a **warning**, never a build failure — `newss` must stay independently buildable.
- Phase 1 writes nothing outside the `newss` repo.
- Existing `routine.md` Tier 1–4 source-verification protocol is unchanged for the deep tier.

## File Structure

| File | Responsibility |
|---|---|
| `server/exam.py` *(create)* | Exam taxonomy constants, curriculum-label loader, wire auto-tagger, promotion matcher |
| `tests/test_exam.py` *(create)* | Unit tests for `server/exam.py` |
| `tests/test_validate.py` *(create)* | Unit tests for the validator — none exist today |
| `tests/fixtures/gk_curriculum.md` *(create)* | Fixture curriculum for label-loading tests |
| `feeds.json` *(modify)* | +~20 feeds across new lanes |
| `scripts/validate_articles.py` *(modify)* | Three-tier schema validation |
| `app/index.html` *(modify)* | Exam rail (reader) + briefs and wire (home) |
| `routine.md` *(modify)* | Document the three-tier build routine |

---

### Task 1: Feed expansion

**Files:**
- Modify: `feeds.json`
- Test: `tests/test_feeds_config.py` (create)

**Interfaces:**
- Consumes: nothing
- Produces: `feeds.json` with ≥78 entries covering lanes `Sports`, `Entertainment`, `Science`, `Education`, `Government`, `Exam`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_feeds_config.py
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEEDS = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))["feeds"]

REQUIRED_KEYS = {"name", "category", "region", "publisher", "kind", "url"}


def test_every_feed_has_required_keys():
    for f in FEEDS:
        assert REQUIRED_KEYS <= set(f), f"{f.get('name')} missing {REQUIRED_KEYS - set(f)}"


def test_no_duplicate_feed_urls():
    urls = [f["url"] for f in FEEDS]
    assert len(urls) == len(set(urls)), "duplicate feed URLs"


def test_new_lanes_present():
    cats = {f["category"] for f in FEEDS}
    for lane in ("Sports", "Entertainment", "Science", "Education", "Government", "Exam"):
        assert lane in cats, f"missing lane: {lane}"


def test_feed_kind_is_valid():
    for f in FEEDS:
        assert f["kind"] in {"news", "primary", "newsletter", "aggregator"}, f["name"]


def test_exam_lane_feeds_are_aggregators():
    # Google News query feeds must never count toward corroboration
    for f in FEEDS:
        if f["category"] == "Exam":
            assert f["kind"] == "aggregator", f"{f['name']} must be kind=aggregator"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_feeds_config.py -v`
Expected: FAIL on `test_new_lanes_present` — `missing lane: Sports`

- [ ] **Step 3: Add the feeds**

Append these objects to the `feeds` array in `feeds.json`. All were verified reachable on 4 September 2026 except where noted.

```json
{"name":"ESPNcricinfo","category":"Sports","region":"india","publisher":"espncricinfo","kind":"news","url":"https://www.espncricinfo.com/rss/content/story/feeds/0.xml"},
{"name":"The Hindu Sport","category":"Sports","region":"india","publisher":"the-hindu-group","kind":"news","url":"https://www.thehindu.com/sport/feeder/default.rss"},
{"name":"Times of India Sports","category":"Sports","region":"india","publisher":"times-of-india","kind":"news","url":"https://timesofindia.indiatimes.com/rssfeeds/4719148.cms"},
{"name":"Times of India Entertainment","category":"Entertainment","region":"india","publisher":"times-of-india","kind":"news","url":"https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms"},
{"name":"The Hindu Sci-Tech","category":"Science","region":"india","publisher":"the-hindu-group","kind":"news","url":"https://www.thehindu.com/sci-tech/feeder/default.rss"},
{"name":"The Hindu Education","category":"Education","region":"india","publisher":"the-hindu-group","kind":"news","url":"https://www.thehindu.com/education/feeder/default.rss"},
{"name":"The Hindu National","category":"India","region":"india","publisher":"the-hindu-group","kind":"news","url":"https://www.thehindu.com/news/national/feeder/default.rss"},
{"name":"PIB (via Google News)","category":"Government","region":"india","publisher":"pib","kind":"aggregator","url":"https://news.google.com/rss/search?q=site:pib.gov.in&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Appointments","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=%22appointed%22+OR+%22sworn+in%22+India&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Awards","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=award+winner+India&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Schemes","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=government+scheme+launched+India&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Summits","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=India+summit+OR+%22signs+MoU%22&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Defence","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=Indian+defence+exercise+OR+DRDO&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Obituaries","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=%22passes+away%22+veteran+OR+scientist+OR+writer&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Rankings","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=India+ranked+index+report&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Championships","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=wins+championship+OR+title+India&hl=en-IN&gl=IN&ceid=IN:en"},
{"name":"GN Books","category":"Exam","region":"india","publisher":"google-news","kind":"aggregator","url":"https://news.google.com/rss/search?q=book+launched+author+India&hl=en-IN&gl=IN&ceid=IN:en"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_feeds_config.py -v`
Expected: 5 passed

- [ ] **Step 5: Smoke-test the new feeds actually fetch**

Run:
```bash
python -c "
import json,feedparser,warnings,socket
warnings.filterwarnings('ignore'); socket.setdefaulttimeout(15)
new=[f for f in json.load(open('feeds.json',encoding='utf-8'))['feeds']
     if f['category'] in ('Sports','Entertainment','Science','Education','Government','Exam')]
for f in new:
    d=feedparser.parse(f['url'])
    print('%-28s %4d'%(f['name'],len(d.entries)))
"
```
Expected: every feed returns > 0 entries. If one returns 0, remove it from `feeds.json` and note it in the commit message rather than shipping a dead feed.

- [ ] **Step 6: Commit**

```bash
git add feeds.json tests/test_feeds_config.py
git commit -m "feat(feeds): add sports, entertainment, science, education, government and exam-query lanes"
```

---

### Task 2: Exam taxonomy and curriculum loader

**Files:**
- Create: `server/exam.py`
- Create: `tests/test_exam.py`
- Create: `tests/fixtures/gk_curriculum.md`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `FACT_KINDS: frozenset[str]`
  - `RELEVANCE: frozenset[str]` (deep/brief values)
  - `WIRE_RELEVANCE: str` = `"unscored"`
  - `CURRICULUM_PATH: Path` — default location of `AAI/GK_CURRICULUM.md`
  - `load_curriculum_labels(path: Path) -> set[str]` — empty set when file absent

- [ ] **Step 1: Write the fixture curriculum**

```markdown
<!-- tests/fixtures/gk_curriculum.md -->
# AAI JE (Operations) — Static GK Curriculum

Preamble prose that must not be parsed as a label.

## Category status

| Category | Status | Notes |
|---|---|---|
| Sports — records, terminology, tournaments | **Learning** | started 29 Aug |
| Books & Authors | **Learning** | |
| Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.) | **Learning** | |

## Session log

| Date | Category | Covered | Outcome |
|---|---|---|---|
| 29 Aug | Curriculum created | Category map built | — |
```

- [ ] **Step 2: Write the failing test**

```python
# tests/test_exam.py
from pathlib import Path

from server.exam import (
    FACT_KINDS,
    RELEVANCE,
    WIRE_RELEVANCE,
    load_curriculum_labels,
)

FIXTURE = Path(__file__).parent / "fixtures" / "gk_curriculum.md"


def test_fact_kinds_is_the_closed_taxonomy():
    assert FACT_KINDS == frozenset({
        "officeholder", "date", "number", "award", "scheme",
        "record", "place", "book", "obituary", "body",
    })


def test_relevance_values():
    assert RELEVANCE == frozenset({"high", "medium", "none"})
    assert WIRE_RELEVANCE == "unscored"


def test_load_curriculum_labels_reads_category_status_table():
    labels = load_curriculum_labels(FIXTURE)
    assert "Sports — records, terminology, tournaments" in labels
    assert "Books & Authors" in labels
    assert "Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.)" in labels


def test_load_curriculum_labels_ignores_session_log_table():
    # The session log's first column holds dates, not category labels.
    labels = load_curriculum_labels(FIXTURE)
    assert "29 Aug" not in labels
    assert "Date" not in labels


def test_load_curriculum_labels_ignores_header_and_separator_rows():
    labels = load_curriculum_labels(FIXTURE)
    assert "Category" not in labels
    assert not any(set(l) <= set("-: ") for l in labels)


def test_load_curriculum_labels_returns_empty_set_when_file_missing(tmp_path):
    assert load_curriculum_labels(tmp_path / "nope.md") == set()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_exam.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.exam'`

- [ ] **Step 4: Write the implementation**

```python
# server/exam.py
"""Exam-layer helpers for the AAI study integration.

Owns the closed fact taxonomy, loads category labels from the study repo's
GK curriculum, and auto-tags wire-tier items. Deep and brief exam blocks are
hand-authored during the digest build; only wire is classified here.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Closed taxonomy. Closed so facts can be drilled by type later — "name the
#: officeholder" is a different exercise from "recall the number".
FACT_KINDS = frozenset({
    "officeholder", "date", "number", "award", "scheme",
    "record", "place", "book", "obituary", "body",
})

#: Relevance values for hand-authored tiers.
RELEVANCE = frozenset({"high", "medium", "none"})

#: Wire items are machine-tagged, never hand-read, so they get their own value.
WIRE_RELEVANCE = "unscored"

#: The study repo sits beside TOMORROW/ on this machine. Absence is tolerated.
CURRICULUM_PATH = ROOT.parent.parent / "AAI" / "GK_CURRICULUM.md"

_CATEGORY_HEADING = "## category status"


def load_curriculum_labels(path: Path = CURRICULUM_PATH) -> set[str]:
    """Return the category row labels from GK_CURRICULUM.md's status table.

    Only the table under '## Category status' is read — the session-log table
    further down has dates in its first column, which are not labels.

    Returns an empty set if the file is absent so that `newss` stays
    independently buildable when cloned without the study repo.
    """
    if not path.exists():
        return set()

    labels: set[str] = set()
    in_section = False

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            in_section = line.lower().startswith(_CATEGORY_HEADING)
            continue
        if not in_section or not line.startswith("|"):
            continue

        cells = [c.strip() for c in line.strip("|").split("|")]
        if not cells:
            continue
        label = cells[0]
        if not label or label == "Category" or set(label) <= set("-: "):
            continue
        labels.add(label)

    return labels
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_exam.py -v`
Expected: 6 passed

- [ ] **Step 6: Verify against the real curriculum file**

Run:
```bash
python -c "
from server.exam import load_curriculum_labels, CURRICULUM_PATH
labels = load_curriculum_labels()
print('curriculum found:', CURRICULUM_PATH.exists())
print('labels:', len(labels))
for l in sorted(labels): print(' -', l)
"
```
Expected: `curriculum found: True`, 19 labels, none of them a date or the word `Category`.

- [ ] **Step 7: Commit**

```bash
git add server/exam.py tests/test_exam.py tests/fixtures/gk_curriculum.md
git commit -m "feat(exam): fact taxonomy and GK curriculum label loader"
```

---

### Task 3: Wire auto-tagging and promotion matcher

**Files:**
- Modify: `server/exam.py`
- Modify: `tests/test_exam.py`

**Interfaces:**
- Consumes: `FACT_KINDS`, `WIRE_RELEVANCE` from Task 2
- Produces:
  - `tag_wire_category(title: str) -> str | None`
  - `should_promote(title: str) -> bool`
  - `build_wire_exam(title: str) -> dict` — the complete wire `exam` block

- [ ] **Step 1: Write the failing test**

Append to `tests/test_exam.py`:

```python
from server.exam import build_wire_exam, should_promote, tag_wire_category


def test_tag_wire_category_detects_sport():
    assert tag_wire_category(
        "India beat Australia by 6 wickets to win the ODI series"
    ) == "Sports — records, terminology, tournaments"


def test_tag_wire_category_detects_appointment():
    assert tag_wire_category(
        "Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman"
    ) == "Current affairs — recent appointments/schemes/awards (India, live)"


def test_tag_wire_category_returns_none_for_unmatched():
    assert tag_wire_category("Sensex rebounds 730 points in early trade") is None


def test_should_promote_flags_appointments():
    assert should_promote("Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman")


def test_should_promote_flags_awards_records_and_obituaries():
    assert should_promote("Indian shooter sets world record in Cairo")
    assert should_promote("Veteran playwright passes away at 88")
    assert should_promote("Scientist conferred Padma Bhushan")


def test_should_promote_ignores_routine_market_headlines():
    assert not should_promote("Sensex rebounds 730 points as Waller cools hike bets")
    assert not should_promote("Gold slips Rs 431 ahead of US payrolls")


def test_build_wire_exam_shape():
    block = build_wire_exam("Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman")
    assert block["relevance"] == "unscored"
    assert block["promote"] is True
    assert block["facts"] == []
    assert block["drill"] is None
    assert block["categories"] == [
        "Current affairs — recent appointments/schemes/awards (India, live)"
    ]


def test_build_wire_exam_empty_categories_when_unmatched():
    block = build_wire_exam("Sensex rebounds 730 points in early trade")
    assert block["categories"] == []
    assert block["promote"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_exam.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_wire_exam'`

- [ ] **Step 3: Write the implementation**

Append to `server/exam.py`:

```python
#: Keyword sets per curriculum row. Labels here MUST match GK_CURRICULUM.md
#: verbatim — the validator rejects anything that does not.
CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Sports — records, terminology, tournaments": (
        "cricket", "odi", "t20", "test match", "world cup", "olympic",
        "tournament", "championship", "medal", "trophy", "fifa",
        "badminton", "chess", "hockey", "wickets", "innings",
    ),
    "Awards & Honours (Bharat Ratna, Padma, Khel Ratna, Nobel)": (
        "padma", "bharat ratna", "nobel", "khel ratna", "laureate",
        "conferred", "honoured with",
    ),
    "Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.)": (
        "chief election commissioner", "vice president", "chief justice",
        "un secretary-general", "rbi governor", "cabinet secretary",
    ),
    "Current affairs — recent appointments/schemes/awards (India, live)": (
        "appointed", "appoints", "sworn in", "takes charge",
        "yojana", "scheme", "mission launched",
    ),
    "Economy & Banking bodies (RBI, SEBI, NABARD, IBRD, IMF, etc.)": (
        "rbi", "sebi", "nabard", "imf", "world bank", "repo rate",
        "monetary policy",
    ),
    "Books & Authors": ("memoir", "novel", "author", "book launched"),
    "Science — Pioneers & discoveries (vaccines, inventions, laws)": (
        "isro", "satellite", "launch vehicle", "vaccine", "spacecraft",
    ),
}

#: Headline shapes that signal an examinable fact. Deliberately excludes bare
#: "index" and "rise/fall", which match routine market copy.
PROMOTE_PATTERNS: tuple[str, ...] = (
    "appointed", "appoints", "sworn in", "takes charge", "takes over as",
    "conferred", "honoured with", "wins award", "awarded",
    "launches scheme", "inaugurates", "unveils",
    "sets record", "breaks record", "world record",
    "passes away", "dies at", "dead at",
    "ranked", "tops the list",
    "summit", "signs mou", "signs agreement",
    "clinches", "lifts the title", "wins the title",
)


def tag_wire_category(title: str) -> str | None:
    """Best-effort curriculum category for a wire headline.

    Scores each category by keyword hits and returns the leader, or None when
    nothing matches. Lower quality than hand-authoring by design — wire items
    are barred from the question bank until promoted and hand-verified.
    """
    text = title.lower()
    best: str | None = None
    best_hits = 0
    for label, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for k in keywords if k in text)
        if hits > best_hits:
            best, best_hits = label, hits
    return best


def should_promote(title: str) -> bool:
    """True when a headline looks like it carries an examinable fact.

    Promoted wire items become the candidate pool for the next edition's brief
    tier, so brief selection is pre-filtered instead of hand-scanned.
    """
    text = title.lower()
    return any(p in text for p in PROMOTE_PATTERNS)


def build_wire_exam(title: str) -> dict:
    """The complete `exam` block for a wire-tier item."""
    category = tag_wire_category(title)
    return {
        "relevance": WIRE_RELEVANCE,
        "categories": [category] if category else [],
        "facts": [],
        "drill": None,
        "promote": should_promote(title),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_exam.py -v`
Expected: 14 passed

- [ ] **Step 5: Sanity-check the matcher against real headlines**

Run:
```bash
python -c "
from server.exam import build_wire_exam
for t in ['Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman',
          'India beat Australia by 6 wickets to win the ODI series',
          'Sensex rebounds 730 points as Waller cools hike bets',
          'Veteran playwright passes away at 88']:
    b=build_wire_exam(t); print(('PROMOTE' if b['promote'] else '       '), (b['categories'] or ['-'])[0][:44], '|', t[:46])
"
```
Expected: the first, second and fourth promote; the Sensex line does not and has no category.

- [ ] **Step 6: Commit**

```bash
git add server/exam.py tests/test_exam.py
git commit -m "feat(exam): wire auto-tagging and promotion matcher"
```

---

### Task 4: Three-tier validation

**Files:**
- Modify: `scripts/validate_articles.py`
- Create: `tests/test_validate.py`

**Interfaces:**
- Consumes: `FACT_KINDS`, `RELEVANCE`, `WIRE_RELEVANCE`, `load_curriculum_labels` from Tasks 2–3
- Produces: `validate(data: dict, curriculum: set[str] | None = None) -> list[str]`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_validate.py
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "validate_articles", ROOT / "scripts" / "validate_articles.py"
)
validate_articles = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validate_articles)
validate = validate_articles.validate

CURRICULUM = {"Sports — records, terminology, tournaments", "Books & Authors"}


def _exam(relevance="none", categories=None, facts=None, drill=None):
    return {
        "relevance": relevance,
        "categories": categories or [],
        "facts": facts or [],
        "drill": drill,
    }


def _article(**over):
    a = {
        "title": "T", "summary": "S", "body": " ".join(["w"] * 250),
        "category": "Markets", "source": "Src", "url": "https://e.com/a",
        "published": "2026-09-04T10:00:00+05:30", "top_story": False,
        "confidence": "single", "exam": _exam(),
    }
    a.update(over)
    return a


def _doc(articles=None, briefs=None, wire=None):
    return {
        "generated_at": "2026-09-04T10:00:00+05:30",
        "edition": "morning",
        "articles": articles if articles is not None else [_article() for _ in range(12)],
        "briefs": briefs if briefs is not None else [],
        "wire": wire if wire is not None else [],
    }


def test_valid_document_passes():
    assert validate(_doc(), CURRICULUM) == []


def test_article_count_upper_bound_is_25():
    errs = validate(_doc(articles=[_article() for _ in range(26)]), CURRICULUM)
    assert any("expected 12-25 articles" in e for e in errs)


def test_missing_exam_block_is_rejected():
    a = _article()
    del a["exam"]
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("missing exam" in e for e in errs)


def test_bad_fact_kind_is_rejected():
    a = _article(exam=_exam(
        relevance="medium",
        facts=[{"fact": "F", "kind": "vibes", "as_of": "2026-09-04"}],
    ))
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("invalid fact kind 'vibes'" in e for e in errs)


def test_fact_missing_as_of_is_rejected():
    a = _article(exam=_exam(
        relevance="medium", facts=[{"fact": "F", "kind": "date"}],
    ))
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("fact missing 'as_of'" in e for e in errs)


def test_category_not_in_curriculum_is_rejected():
    a = _article(exam=_exam(relevance="medium", categories=["Made Up Row"]))
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("unknown curriculum category" in e for e in errs)


def test_category_check_degrades_to_warning_when_curriculum_absent():
    a = _article(exam=_exam(relevance="medium", categories=["Made Up Row"]))
    errs = validate(_doc(articles=[a] * 12), set())
    assert not any("unknown curriculum category" in e for e in errs)


def test_high_relevance_requires_well_formed_drill():
    a = _article(exam=_exam(
        relevance="high",
        drill={"q": "Q", "options": ["a", "b"], "answer": 1},
    ))
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("drill needs exactly 4 options" in e for e in errs)


def test_drill_answer_must_be_1_indexed_within_range():
    a = _article(exam=_exam(
        relevance="high",
        drill={"q": "Q", "options": ["a", "b", "c", "d"], "answer": 0},
    ))
    errs = validate(_doc(articles=[a] * 12), CURRICULUM)
    assert any("drill answer must be 1-4" in e for e in errs)


def test_wire_item_must_not_carry_facts():
    w = {
        "title": "T", "source": "S", "url": "https://e.com/w",
        "published": "2026-09-04T10:00:00+05:30", "category": "Sports",
        "exam": {"relevance": "unscored", "categories": [], "facts": [],
                 "drill": None, "promote": False},
    }
    bad = dict(w)
    bad["exam"] = dict(w["exam"], facts=[{"fact": "F", "kind": "date", "as_of": "2026-09-04"}])
    errs = validate(_doc(wire=[bad]), CURRICULUM)
    assert any("wire item must not carry facts" in e for e in errs)


def test_wire_relevance_must_be_unscored():
    w = {
        "title": "T", "source": "S", "url": "https://e.com/w2",
        "published": "2026-09-04T10:00:00+05:30", "category": "Sports",
        "exam": {"relevance": "high", "categories": [], "facts": [],
                 "drill": None, "promote": False},
    }
    errs = validate(_doc(wire=[w]), CURRICULUM)
    assert any("wire relevance must be 'unscored'" in e for e in errs)


def test_duplicate_url_across_tiers_is_rejected():
    b = {
        "text": "A brief.", "category": "Sports", "date": "2026-09-04",
        "source": "S", "url": "https://e.com/a", "exam": _exam(),
    }
    errs = validate(_doc(briefs=[b]), CURRICULUM)
    assert any("duplicate url" in e for e in errs)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_validate.py -v`
Expected: FAIL — `TypeError: validate() takes 1 positional argument but 2 were given`

- [ ] **Step 3: Rewrite the validator**

Replace the body of `scripts/validate_articles.py` between the imports and `main()` with:

```python
#!/usr/bin/env python3
"""Validate app/articles.json against the three-tier digest schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
ARTICLES = ROOT / "app" / "articles.json"

from server.exam import (  # noqa: E402
    FACT_KINDS,
    RELEVANCE,
    WIRE_RELEVANCE,
    load_curriculum_labels,
)

CATEGORIES = {
    "Markets", "Economy & Policy", "Business", "Startups", "AI", "Innovation",
    "Geopolitics", "India", "Aviation", "World", "Analysis",
    "Sports", "Entertainment", "Science", "Education", "Government",
}
CONFIDENCE = {
    "primary", "corroborated", "thin", "single",
    "verified", "single_sourced", "rumour",   # legacy
}
EDITIONS = {"morning", "evening"}
REQUIRED_ARTICLE = {
    "title", "summary", "body", "category", "source", "url",
    "published", "top_story", "confidence", "exam",
}
REQUIRED_BRIEF = {"text", "category", "date", "source", "url", "exam"}
REQUIRED_WIRE = {"title", "source", "url", "published", "category", "exam"}


def _check_exam(exam, prefix, curriculum, errors, *, wire=False):
    """Validate one exam block. `curriculum` empty means the check is skipped."""
    if not isinstance(exam, dict):
        errors.append(f"{prefix}: exam must be an object")
        return

    relevance = exam.get("relevance")
    if wire:
        if relevance != WIRE_RELEVANCE:
            errors.append(f"{prefix}: wire relevance must be '{WIRE_RELEVANCE}'")
        if exam.get("facts"):
            errors.append(f"{prefix}: wire item must not carry facts")
        if exam.get("drill") is not None:
            errors.append(f"{prefix}: wire item must not carry drill")
    elif relevance not in RELEVANCE:
        errors.append(f"{prefix}: relevance must be one of {sorted(RELEVANCE)}")

    for label in exam.get("categories") or []:
        # Empty curriculum == study repo absent; degrade to skip, never fail.
        if curriculum and label not in curriculum:
            errors.append(f"{prefix}: unknown curriculum category {label!r}")

    for j, fact in enumerate(exam.get("facts") or []):
        fp = f"{prefix}.facts[{j}]"
        if not fact.get("fact"):
            errors.append(f"{fp}: fact missing 'fact'")
        if fact.get("kind") not in FACT_KINDS:
            errors.append(f"{fp}: invalid fact kind {fact.get('kind')!r}")
        if not fact.get("as_of"):
            errors.append(f"{fp}: fact missing 'as_of'")

    drill = exam.get("drill")
    if relevance == "high" and drill is not None:
        options = drill.get("options") or []
        if len(options) != 4:
            errors.append(f"{prefix}: drill needs exactly 4 options, got {len(options)}")
        answer = drill.get("answer")
        if not isinstance(answer, int) or not 1 <= answer <= 4:
            errors.append(f"{prefix}: drill answer must be 1-4, got {answer!r}")
        if not drill.get("q"):
            errors.append(f"{prefix}: drill missing 'q'")


def validate(data: dict, curriculum: set[str] | None = None) -> list[str]:
    errors: list[str] = []
    if curriculum is None:
        curriculum = load_curriculum_labels()

    if "generated_at" not in data:
        errors.append("missing generated_at")
    if data.get("edition") not in EDITIONS:
        errors.append(f"edition must be one of {sorted(EDITIONS)}")

    articles = data.get("articles")
    if not isinstance(articles, list):
        errors.append("articles must be a list")
        return errors

    if not (12 <= len(articles) <= 25):
        errors.append(f"expected 12-25 articles, got {len(articles)}")

    top = sum(1 for a in articles if a.get("top_story"))
    if top > 5:
        errors.append(f"max 5 top_story items, got {top}")

    seen_urls: set[str] = set()

    def _dedupe(url, prefix):
        if not url:
            return
        if url in seen_urls:
            errors.append(f"{prefix}: duplicate url {url}")
        seen_urls.add(url)

    for i, a in enumerate(articles):
        prefix = f"articles[{i}]"
        missing = REQUIRED_ARTICLE - set(a)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        if a.get("category") not in CATEGORIES:
            errors.append(f"{prefix}: invalid category {a.get('category')!r}")
        if a.get("confidence") not in CONFIDENCE:
            errors.append(f"{prefix}: confidence must be one of {sorted(CONFIDENCE)}")
        if not a.get("url", "").startswith("http"):
            errors.append(f"{prefix}: invalid url")
        body_words = len(a.get("body", "").split())
        if body_words < 200:
            errors.append(f"{prefix}: body too short ({body_words} words)")
        _dedupe(a.get("url"), prefix)
        if "exam" in a:
            _check_exam(a["exam"], prefix, curriculum, errors)

    briefs = data.get("briefs") or []
    if not isinstance(briefs, list):
        errors.append("briefs must be a list")
        briefs = []
    if len(briefs) > 80:
        errors.append(f"expected at most 80 briefs, got {len(briefs)}")
    for i, b in enumerate(briefs):
        prefix = f"briefs[{i}]"
        missing = REQUIRED_BRIEF - set(b)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        if b.get("category") not in CATEGORIES:
            errors.append(f"{prefix}: invalid category {b.get('category')!r}")
        _dedupe(b.get("url"), prefix)
        if "exam" in b:
            _check_exam(b["exam"], prefix, curriculum, errors)

    wire = data.get("wire") or []
    if not isinstance(wire, list):
        errors.append("wire must be a list")
        wire = []
    if len(wire) > 600:
        errors.append(f"expected at most 600 wire items, got {len(wire)}")
    for i, w in enumerate(wire):
        prefix = f"wire[{i}]"
        missing = REQUIRED_WIRE - set(w)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        _dedupe(w.get("url"), prefix)
        if "exam" in w:
            _check_exam(w["exam"], prefix, curriculum, errors, wire=True)

    return errors
```

Then update `main()`'s success line:

```python
    print(
        f"OK: {len(data['articles'])} articles, "
        f"{len(data.get('briefs') or [])} briefs, "
        f"{len(data.get('wire') or [])} wire, "
        f"edition={data.get('edition')}"
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_validate.py -v`
Expected: 12 passed

- [ ] **Step 5: Verify the current edition still validates**

The live `app/articles.json` has no `exam`, `briefs` or `wire` keys yet, so this must fail loudly on `missing ['exam']` — that is correct and proves the rule bites.

Run: `python scripts/validate_articles.py`
Expected: 20 `missing ['exam']` errors, exit 1.

Then backfill a `relevance: none` block into every article so the repo stays green:

```bash
python -c "
import json
p='app/articles.json'
d=json.load(open(p,encoding='utf-8'))
for a in d['articles']:
    a.setdefault('exam', {'relevance':'none','categories':[],'facts':[],'drill':None})
d.setdefault('briefs', []); d.setdefault('wire', [])
json.dump(d, open(p,'w',encoding='utf-8'), indent=2, ensure_ascii=False)
print('backfilled', len(d['articles']))
"
python scripts/validate_articles.py
```
Expected: `OK: 20 articles, 0 briefs, 0 wire, edition=evening`

- [ ] **Step 6: Run the whole suite**

Run: `python -m pytest -q`
Expected: all tests pass, no regressions in `test_feeds.py` / `test_extractor.py`.

- [ ] **Step 7: Commit**

```bash
git add scripts/validate_articles.py tests/test_validate.py app/articles.json
git commit -m "feat(validate): three-tier schema with exam block, briefs and wire"
```

---

### Task 5: Reader exam rail

**Files:**
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `article.exam` shape from Tasks 2–4
- Produces: `examRail(a) -> string` JS helper; `.examrail` CSS class

- [ ] **Step 1: Add the rail CSS**

In the `@media (min-width: 1180px)` block in `app/index.html`, replace the two `.art > *` rules added on 4 September with:

```css
    /* Two-column reader: prose keeps its measure, rail fills the gutter. */
    .art { display:grid; grid-template-columns:820px minmax(300px,1fr); gap:40px; align-items:start; }
    .art > * { grid-column:1; max-width:820px; }
    .art > .lead, .art > .nums { max-width:none; }
    .art > .lead { max-height:420px; }
    .art > .examrail { grid-column:2; max-width:none; position:sticky; top:72px; }
    .art.norail { grid-template-columns:minmax(0,820px); justify-content:center; }
```

Then add, outside any media query (so the rail also renders inline on phones):

```css
  .examrail {
    background:var(--surface); border:1px solid var(--accent-dim); border-radius:18px;
    padding:16px 16px 18px; margin:22px 0;
  }
  .examrail h3 {
    margin:0 0 12px; font-size:11.5px; font-weight:800; letter-spacing:.12em;
    text-transform:uppercase; color:var(--accent);
  }
  .efact { padding:9px 0; border-bottom:1px solid var(--line-soft); }
  .efact:last-of-type { border-bottom:none; }
  .ekind {
    font-size:9.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:var(--faint);
  }
  .etext { font-size:13.5px; line-height:1.45; margin-top:3px; }
  .eas { font-size:10.5px; color:var(--faint); margin-top:4px; }
  .edrill { margin-top:12px; border-top:1px solid var(--line); padding-top:12px; }
  .edrill summary { font-size:12.5px; font-weight:700; color:var(--accent); cursor:pointer; }
  .edrill ol { margin:8px 0 0; padding-left:20px; font-size:13px; line-height:1.6; }
  .eans { font-size:12px; color:var(--faint); margin:8px 0 0; }
```

- [ ] **Step 2: Add the render helper**

In the `<script>` block, immediately before `function openArt(`, add:

```js
  function examRail(a) {
    var e = a.exam;
    if (!e || e.relevance === "none" || e.relevance === "unscored") return "";
    var facts = e.facts || [];
    if (!facts.length) return "";
    var chips = facts.map(function (f) {
      return '<div class="efact"><div class="ekind">' + esc(f.kind) + "</div>" +
        '<div class="etext">' + hl(esc(f.fact)) + "</div>" +
        '<div class="eas">as of ' + esc(f.as_of) + "</div></div>";
    }).join("");
    var d = e.drill;
    var drill = d ? '<details class="edrill"><summary>Test yourself</summary><p>' +
      esc(d.q) + "</p><ol>" +
      (d.options || []).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") +
      '</ol><p class="eans">Answer: ' + esc(String(d.answer)) + "</p></details>" : "";
    return '<aside class="examrail"><h3>For the exam</h3>' + chips + drill + "</aside>";
  }
```

`hl()` is the existing figure-highlighting helper defined earlier in the script; it wraps
numbers in `<mark>`, so exam facts get the same number emphasis as article bodies.

- [ ] **Step 3: Wire the rail into the article render**

In `openArt()`, append `examRail(a)` to the `$("art").innerHTML` expression, immediately after the `.byline` div and before the `simple` block, then set the no-rail class:

```js
      '<div class="byline">' + esc(a.source) + " · " + ago(a.published) + " · " + a.read_min +
      " min · " + (a.region === "india" ? "India" : "Global") + "</div>" +
      examRail(a) +
      (simple ? '<div class="simple">...' /* unchanged */
```

Immediately after the `$("art").innerHTML = ...` assignment, add:

```js
    $("art").classList.toggle("norail", !examRail(a));
```

- [ ] **Step 4: Verify in a real browser**

```bash
cd app && python -m http.server 8899 &
```

Check, using the responsive-QA method from 4 September:
- **1600px** — article with facts shows a sticky rail in the right gutter; prose stays at 820px.
- **1600px, `relevance:none` article** — single centred column, no empty second column.
- **390px** — rail appears inline below the byline, full width, nothing clipped.

Kill the server when done.

- [ ] **Step 5: Commit**

```bash
git add app/index.html
git commit -m "feat(reader): sticky exam rail in the desktop gutter, inline on mobile"
```

---

### Task 6: Home restructure — briefs and wire

**Files:**
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `DATA` plus new globals `BRIEFS`, `WIRE` parsed from `articles.json`
- Produces: `briefList()`, `wireList()` JS helpers appended by `renderHome()`

- [ ] **Step 1: Add the CSS**

```css
  /* ---------- briefs ---------- */
  .brow { display:flex; gap:11px; padding:11px 0; border-bottom:1px solid var(--line-soft); }
  .brow .bdate { font-size:11px; color:var(--faint); flex:none; width:52px; padding-top:2px; }
  .brow .btxt { font-size:14.5px; line-height:1.5; flex:1; }
  .brow .bcat {
    font-size:9.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:var(--accent); display:block; margin-bottom:3px;
  }
  .bexam {
    font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
    color:var(--hot); background:var(--hot-wash); border-radius:5px; padding:2px 6px;
    margin-left:7px;
  }
  /* ---------- wire ---------- */
  .wire { margin:26px 0 10px; }
  .wire > summary {
    font-size:14px; font-weight:700; padding:13px 15px; border-radius:14px;
    background:var(--surface); border:1px solid var(--line); cursor:pointer;
  }
  .wirelist { max-height:70vh; overflow-y:auto; margin-top:10px; }
  .wrow {
    display:flex; gap:10px; align-items:baseline; padding:9px 2px;
    border-bottom:1px solid var(--line-soft); text-decoration:none;
  }
  .wrow .wcat { font-size:9.5px; font-weight:700; letter-spacing:.08em;
                text-transform:uppercase; color:var(--faint); flex:none; width:78px; }
  .wrow .wt { font-size:13.5px; line-height:1.45; flex:1; }
  .wrow .wsrc { font-size:10.5px; color:var(--faint); flex:none; }
```

- [ ] **Step 2: Parse the new arrays**

Find where `DATA` is assigned from the fetched JSON and add alongside it:

```js
  var BRIEFS = [], WIRE = [];
```

and in the fetch handler, after `DATA = j.articles || [];`:

```js
    BRIEFS = j.briefs || [];
    WIRE = j.wire || [];
```

- [ ] **Step 3: Add the render helpers**

Before `function renderHome()`:

```js
  function briefList() {
    if (!BRIEFS.length) return "";
    var rows = BRIEFS.map(function (b) {
      var flag = b.exam && b.exam.relevance === "high"
        ? '<span class="bexam">exam</span>' : "";
      return '<div class="brow"><div class="bdate">' + esc(b.date.slice(5)) + "</div>" +
        '<div class="btxt"><span class="bcat">' + esc(b.category) + flag + "</span>" +
        hl(esc(b.text)) + "</div></div>";
    }).join("");
    return '<div class="shead"><h2>In brief</h2><span class="seeall">' +
      BRIEFS.length + " items</span></div>" + rows;
  }

  function wireList() {
    if (!WIRE.length) return "";
    var rows = WIRE.map(function (w) {
      return '<a class="wrow" href="' + esc(w.url) + '" target="_blank" rel="noopener">' +
        '<span class="wcat">' + esc(w.category) + "</span>" +
        '<span class="wt">' + esc(w.title) + "</span>" +
        '<span class="wsrc">' + esc(w.source) + "</span></a>";
    }).join("");
    return '<details class="wire"><summary>' + WIRE.length +
      " more stories today</summary>" +
      '<div class="wirelist">' + rows + "</div></details>";
  }
```

- [ ] **Step 4: Append them in renderHome()**

Change the final lines of `renderHome()` from `$("view").innerHTML = h;` to:

```js
    h += briefList() + wireList();
    $("view").innerHTML = h;
```

- [ ] **Step 5: Verify with fixture data**

```bash
python -c "
import json
p='app/articles.json'; d=json.load(open(p,encoding='utf-8'))
d['briefs']=[{'text':'India beat Australia by 6 wickets to take the ODI series 2-1.',
  'category':'Sports','date':'2026-09-04','source':'ESPNcricinfo','url':'https://x.test/1',
  'exam':{'relevance':'high','categories':[],'facts':[],'drill':None}}]
d['wire']=[{'title':'Wire headline %d'%i,'source':'Src','url':'https://x.test/w%d'%i,
  'published':'2026-09-04T10:00:00+05:30','category':'Sports',
  'exam':{'relevance':'unscored','categories':[],'facts':[],'drill':None,'promote':False}}
  for i in range(120)]
json.dump(d,open(p,'w',encoding='utf-8'),indent=2,ensure_ascii=False); print('fixture written')
"
python scripts/validate_articles.py
```
Expected: `OK: 20 articles, 1 briefs, 120 wire`.

Then serve and check at 1600px and 390px: the brief row renders with its `exam` flag; the wire block is **collapsed by default** and shows "120 more stories today"; expanding it scrolls inside `.wirelist` without the page growing unbounded.

Finally revert the fixture:
```bash
git checkout app/articles.json
```

- [ ] **Step 6: Commit**

```bash
git add app/index.html
git commit -m "feat(home): briefs list and collapsed wire block"
```

---

### Task 7: Document the three-tier routine

**Files:**
- Modify: `routine.md`

**Interfaces:**
- Consumes: everything above
- Produces: the operating procedure the digest build follows each edition

- [ ] **Step 1: Add the tier section**

Insert after the numbered steps in `routine.md`:

```markdown
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
```

- [ ] **Step 2: Verify the whole pipeline once**

Run: `python -m pytest -q && python scripts/validate_articles.py`
Expected: all tests pass; validator reports OK.

- [ ] **Step 3: Commit**

```bash
git add routine.md
git commit -m "docs(routine): three-tier build procedure"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §1 Three-tier content model | 4 (schema), 7 (procedure) |
| §2 Feed expansion | 1 |
| §3 The `exam` block | 2 (taxonomy), 4 (enforcement) |
| §4 Wire auto-tagging and promotion | 3 |
| §5 Reader rail | 5 |
| §6 Home layout at 300–450 items | 6 |
| §7 Validation | 4 |
| Payload | 6 Step 5 exercises 120 wire items; the ~280KB estimate is measured after the first real edition |
| Testing (spec) | 1, 2, 3, 4 unit tests; 5 and 6 browser checks at 390/1600px |

No spec requirement is unimplemented.

**Placeholder scan** — no `TBD`/`TODO`/"handle edge cases" steps. Every code step carries runnable code. An earlier draft of Task 5 Step 2 contained a deliberate broken token as a "typo guard"; that was removed, since a plan an executor may paste verbatim must never contain intentionally broken code.

**Type consistency** — `build_wire_exam` (Task 3) returns exactly the keys `_check_exam(..., wire=True)` inspects in Task 4: `relevance`, `categories`, `facts`, `drill`, `promote`. `load_curriculum_labels` returns `set[str]`, matching `validate(data, curriculum: set[str] | None)`. `examRail` (Task 5) reads `relevance`, `facts[].kind/fact/as_of`, `drill.q/options/answer` — all as validated in Task 4. Brief keys in Task 6's `briefList()` (`date`, `category`, `text`, `exam.relevance`) match `REQUIRED_BRIEF`.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks.
2. **Inline Execution** — tasks executed in this session with checkpoints.
