# Obsidian Graph View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth "Obsidian" tab to the newss webapp that renders a node-link graph connecting stories (current edition + archive) through shared entities, so recurring names (RBI, Tata Sons, the Fed, Anthropic...) visually cluster the stories that mention them.

**Architecture:** A new build script (`scripts/build_graph.py`) reuses the existing important-item qualification and collection logic (`scripts/build_important.py`) to gather the same bounded pool of high-value stories, matches each against a maintained entity keyword dict, and emits `app/graph.json` (story nodes + entity nodes + story→entity edges). The frontend runs a one-shot `d3-force` simulation to lay the graph out, then renders the settled positions as static SVG — no live animation loop.

**Tech Stack:** Python 3 (stdlib `json`/`pathlib` only, matching `build_important.py`), React 19 + Vite (existing webapp), new runtime dependency `d3-force` (physics-only, no rendering).

**Spec:** `docs/superpowers/specs/2026-09-18-obsidian-graph-view-design.md`

## Global Constraints

- No free-form NLP/NER — entities come from a maintained keyword dict, matched by case-insensitive substring (per spec §2).
- No story-to-story or story-to-category edges — only story→entity (per spec §1, Non-goals).
- The force simulation settles once at build/mount time and renders static SVG; it must not run as a continuous `requestAnimationFrame` animation loop (per spec Non-goals, and the constellation-redesign lesson it references).
- Node pool is bounded to the same qualifying-item filter as `build_important.py` (`importance=="high"` OR `top_story` OR `exam.relevance` in `high`/`medium`) — never the full wire tier (per spec §1).
- An item with zero entity matches produces no story node (per spec §3 step 2).
- `webapp/package.json` currently has only `react`/`react-dom` as runtime deps — `d3-force` is the one deliberate addition, nothing else (per spec Risks).

---

### Task 1: Add a `text` field to `build_important.py`'s `collect()` output

`build_graph.py` needs each qualifying item's body text (article summary / brief text) to search for entity mentions, not just its title. Rather than duplicating `build_important.py`'s collection loop, add the field there and have `build_graph.py` reuse `collect()` directly.

**Files:**
- Modify: `scripts/build_important.py:38-48`
- Create: `tests/test_build_important.py`

**Interfaces:**
- Produces: `collect(edition: dict) -> list[dict]`, each dict gains a `"text"` key (str, may be empty) alongside the existing `title`/`url`/`source`/`category`/`date`/`kind`/`importance`/`top_story`/`exam` keys. Later tasks (`build_graph.py`) rely on this key existing.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_build_important.py`:

```python
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "build_important", ROOT / "scripts" / "build_important.py"
)
build_important = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_important)


def _edition(articles=None, briefs=None, wire=None):
    return {
        "generated_at": "2026-09-18T09:00:00+05:30",
        "edition": "morning",
        "articles": articles or [],
        "briefs": briefs or [],
        "wire": wire or [],
    }


def test_collect_includes_text_from_article_summary():
    edition = _edition(articles=[{
        "title": "Fed hikes rates", "url": "https://e.com/a1", "source": "ET",
        "category": "Markets", "published": "2026-09-18T09:00:00+05:30",
        "importance": "high", "top_story": True,
        "summary": "The Fed raised its benchmark rate a quarter point.",
        "exam": {"relevance": "high", "categories": [], "facts": [], "drill": None},
    }])
    items = build_important.collect(edition)
    assert items[0]["text"] == "The Fed raised its benchmark rate a quarter point."


def test_collect_includes_text_from_brief_text_field():
    edition = _edition(briefs=[{
        "title": None, "text": "RBI may hike in October.", "url": "https://e.com/b1",
        "source": "ET", "category": "Economy & Policy", "date": "2026-09-18",
        "importance": "high",
        "exam": {"relevance": "high", "categories": [], "facts": [], "drill": None},
    }])
    items = build_important.collect(edition)
    assert items[0]["text"] == "RBI may hike in October."


def test_collect_text_is_empty_string_when_no_summary_or_text():
    edition = _edition(wire=[{
        "title": "Some wire headline", "url": "https://e.com/w1", "source": "ET",
        "category": "World", "published": "2026-09-18T09:00:00+05:30",
        "importance": "high",
        "exam": {"relevance": "unscored", "categories": [], "facts": [], "drill": None, "promote": False},
    }])
    items = build_important.collect(edition)
    assert items[0]["text"] == ""
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_build_important.py -v`
Expected: FAIL — `KeyError: 'text'` on all three tests (the field doesn't exist yet).

- [ ] **Step 3: Add the `text` field**

Edit `scripts/build_important.py`, inside `collect()` (currently lines 38-48):

```python
            out.append({
                "title": item.get("title") or item.get("text"),
                "url": url,
                "source": item.get("source"),
                "category": item.get("category"),
                "date": item.get(date_field) or date,
                "kind": kind,
                "importance": item.get("importance"),
                "top_story": bool(item.get("top_story")),
                "exam": item.get("exam") or {"relevance": "none"},
                "text": item.get("summary") or item.get("text") or "",
            })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_build_important.py -v`
Expected: 3 passed

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `python -m pytest -q`
Expected: all existing tests still pass (this is an additive field; nothing reads a fixed-key dict shape elsewhere)

- [ ] **Step 6: Commit**

```bash
git add scripts/build_important.py tests/test_build_important.py
git commit -m "feat: add text field to build_important collect() for entity matching"
```

---

### Task 2: Create `scripts/build_graph.py` with entity matching and graph construction

**Files:**
- Create: `scripts/build_graph.py`
- Create: `tests/test_build_graph.py`

**Interfaces:**
- Consumes: `build_important.collect(edition: dict) -> list[dict]` (from Task 1, including `text` key)
- Produces:
  - `ENTITIES: dict[str, list[str]]` — entity name to keyword-variant list
  - `match_entities(text: str) -> list[str]` — sorted list of matched entity names
  - `build_graph(editions: list[dict]) -> dict` — returns `{"nodes": [...], "edges": [...]}`
  - `main()` — writes `app/graph.json`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_build_graph.py`:

```python
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "build_graph", ROOT / "scripts" / "build_graph.py"
)
build_graph_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_graph_mod)

match_entities = build_graph_mod.match_entities
build_graph = build_graph_mod.build_graph


def _edition(articles=None, briefs=None, wire=None, generated_at="2026-09-18T09:00:00+05:30"):
    return {
        "generated_at": generated_at,
        "edition": "morning",
        "articles": articles or [],
        "briefs": briefs or [],
        "wire": wire or [],
    }


def _exam(relevance="none", categories=None):
    return {"relevance": relevance, "categories": categories or [], "facts": [], "drill": None}


def _article(url, title, summary="", importance="high", top_story=False, exam=None, category="Markets"):
    return {
        "title": title, "url": url, "source": "ET", "category": category,
        "published": "2026-09-18T09:00:00+05:30", "importance": importance,
        "top_story": top_story, "summary": summary, "exam": exam or _exam(),
    }


def test_match_entities_is_case_insensitive():
    assert "RBI" in match_entities("the rbi may hike rates")


def test_match_entities_matches_keyword_variant():
    assert "Fed" in match_entities("The Federal Reserve raised rates")


def test_match_entities_returns_multiple_matches():
    matches = match_entities("Tata Sons partners with Anthropic on Claude")
    assert "Tata Sons" in matches
    assert "Anthropic" in matches


def test_match_entities_returns_empty_for_no_match():
    assert match_entities("Local bakery wins best croissant award") == []


def test_build_graph_creates_story_and_entity_nodes():
    edition = _edition(articles=[
        _article("https://e.com/a1", "RBI faces October-or-December dilemma", "The RBI may hike rates."),
    ])
    graph = build_graph([edition])
    story_nodes = [n for n in graph["nodes"] if n["type"] == "story"]
    entity_nodes = [n for n in graph["nodes"] if n["type"] == "entity"]
    assert len(story_nodes) == 1
    assert story_nodes[0]["id"] == "https://e.com/a1"
    assert any(n["id"] == "RBI" for n in entity_nodes)
    assert graph["edges"] == [{"source": "https://e.com/a1", "target": "RBI"}]


def test_build_graph_drops_items_with_zero_entity_matches():
    edition = _edition(articles=[
        _article("https://e.com/a2", "Local bakery wins best croissant award", "No relevant entities here."),
    ])
    graph = build_graph([edition])
    assert graph["nodes"] == []
    assert graph["edges"] == []


def test_build_graph_dedups_by_url_keeping_newest():
    old_edition = _edition(
        articles=[_article("https://e.com/a3", "RBI old headline", "RBI news.")],
        generated_at="2026-09-10T09:00:00+05:30",
    )
    new_edition = _edition(
        articles=[_article("https://e.com/a3", "RBI new headline", "RBI news.")],
        generated_at="2026-09-18T09:00:00+05:30",
    )
    graph = build_graph([old_edition, new_edition])
    story_nodes = [n for n in graph["nodes"] if n["type"] == "story"]
    assert len(story_nodes) == 1
    assert story_nodes[0]["label"] == "RBI new headline"


def test_build_graph_entity_degree_counts_connected_stories():
    edition = _edition(articles=[
        _article("https://e.com/a4", "RBI hikes rates", "RBI news one."),
        _article("https://e.com/a5", "RBI holds steady", "RBI news two."),
    ])
    graph = build_graph([edition])
    entity_nodes = {n["id"]: n for n in graph["nodes"] if n["type"] == "entity"}
    assert entity_nodes["RBI"]["degree"] == 2


def test_build_graph_entity_exam_tagged_when_a_connected_story_has_categories():
    edition = _edition(articles=[
        _article(
            "https://e.com/a6", "RBI appoints new deputy governor", "RBI news.",
            exam=_exam("high", ["Economy & Banking bodies (RBI, SEBI, NABARD, IBRD, IMF, etc.)"]),
        ),
    ])
    graph = build_graph([edition])
    entity_nodes = {n["id"]: n for n in graph["nodes"] if n["type"] == "entity"}
    assert entity_nodes["RBI"]["examTagged"] is True


def test_build_graph_entity_not_exam_tagged_when_no_connected_story_has_categories():
    edition = _edition(articles=[
        _article("https://e.com/a7", "RBI holds rates steady", "RBI news."),
    ])
    graph = build_graph([edition])
    entity_nodes = {n["id"]: n for n in graph["nodes"] if n["type"] == "entity"}
    assert entity_nodes["RBI"]["examTagged"] is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_build_graph.py -v`
Expected: FAIL — `scripts/build_graph.py` does not exist yet (`FileNotFoundError` / import error from the fixture loader).

- [ ] **Step 3: Write `scripts/build_graph.py`**

```python
# -*- coding: utf-8 -*-
"""Build app/graph.json: a story<->entity node-link graph across all editions.

Reuses build_important.collect()'s qualifying-item pool (importance=="high",
top_story, or exam.relevance in high/medium) across archive/*.json plus the
current edition. Each qualifying item is matched against a maintained entity
keyword dict; items with zero matches are dropped (no isolated story nodes).
Run after build_important.py, before commit.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_important as bi  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IST = timezone(timedelta(hours=5, minutes=30))

ENTITIES = {
    "RBI": ["RBI", "Reserve Bank of India"],
    "SEBI": ["SEBI"],
    "Fed": ["Federal Reserve", "the Fed", "Fed's", "Fed hikes", "Fed rate"],
    "BOJ": ["Bank of Japan", "BOJ"],
    "Tata Sons": ["Tata Sons"],
    "Tata Chemicals": ["Tata Chemicals"],
    "Tata Electronics": ["Tata Electronics"],
    "Anthropic": ["Anthropic", "Claude"],
    "OpenAI": ["OpenAI"],
    "Nexperia": ["Nexperia"],
    "Moody's": ["Moody's"],
    "Trump": ["Trump"],
    "Xi Jinping": ["Xi Jinping", "President Xi"],
    "Amazon": ["Amazon"],
    "Microsoft": ["Microsoft"],
    "Meta": ["Meta"],
    "Google": ["Google", "DeepMind"],
    "IMF": ["IMF"],
    "WTO": ["WTO"],
    "Iran": ["Iran", "Iranian"],
    "Saudi Arabia": ["Saudi Arabia", "Saudi"],
    "Houthi": ["Houthi", "Houthis"],
    "China": ["China", "Chinese"],
    "US Treasury": ["Treasury Secretary", "Scott Bessent"],
    "SEC": [" SEC ", "SEC unveiled", "US SEC"],
    "NaBFID": ["NaBFID"],
    "CBDT": ["CBDT"],
    "GlobalFoundries": ["GlobalFoundries"],
    "Marvell": ["Marvell"],
    "Micron": ["Micron"],
    "King Charles": ["King Charles"],
    "Nvidia": ["Nvidia"],
}


def match_entities(text):
    t = " " + (text or "").lower() + " "
    matches = []
    for name, keywords in ENTITIES.items():
        if any(kw.lower() in t for kw in keywords):
            matches.append(name)
    return sorted(matches)


def build_graph(editions):
    by_url = {}
    for ed in editions:
        for item in bi.collect(ed):
            existing = by_url.get(item["url"])
            if not existing or (item["date"] or "") > (existing["date"] or ""):
                by_url[item["url"]] = item

    story_nodes = []
    edges = []
    entity_degree = {}
    entity_exam_tagged = {}

    for item in by_url.values():
        haystack = (item.get("title") or "") + " " + (item.get("text") or "")
        matches = match_entities(haystack)
        if not matches:
            continue

        story_nodes.append({
            "id": item["url"],
            "type": "story",
            "label": item["title"],
            "category": item.get("category"),
            "exam": item.get("exam") or {"relevance": "none", "categories": []},
            "date": item.get("date"),
            "importance": item.get("importance"),
            "top_story": bool(item.get("top_story")),
        })

        has_categories = bool((item.get("exam") or {}).get("categories"))
        for name in matches:
            edges.append({"source": item["url"], "target": name})
            entity_degree[name] = entity_degree.get(name, 0) + 1
            if has_categories:
                entity_exam_tagged[name] = True

    entity_nodes = [
        {
            "id": name,
            "type": "entity",
            "label": name,
            "degree": degree,
            "examTagged": entity_exam_tagged.get(name, False),
        }
        for name, degree in entity_degree.items()
    ]

    return {"nodes": story_nodes + entity_nodes, "edges": edges}


def main():
    files = sorted(ROOT.glob("archive/*.json"))
    editions = [json.load(open(p, encoding="utf-8")) for p in files]
    current = ROOT / "app" / "articles.json"
    if current.exists():
        editions.append(json.load(open(current, encoding="utf-8")))

    graph = build_graph(editions)
    graph["generated_at"] = datetime.now(IST).isoformat()

    (ROOT / "app" / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    story_count = sum(1 for n in graph["nodes"] if n["type"] == "story")
    entity_count = sum(1 for n in graph["nodes"] if n["type"] == "entity")
    print("graph.json: %d story nodes, %d entity nodes, %d edges from %d editions" % (
        story_count, entity_count, len(graph["edges"]), len(editions)
    ))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_build_graph.py -v`
Expected: 9 passed

- [ ] **Step 5: Run the full test suite**

Run: `python -m pytest -q`
Expected: all tests pass (Task 1's 3 + Task 2's 9 + prior 50 = 62 passed)

- [ ] **Step 6: Run the script against real repo data and sanity-check the output**

Run: `python scripts/build_graph.py`
Expected output resembles: `graph.json: N story nodes, M entity nodes, K edges from 6 editions`
(N/M/K depend on current archive contents — sanity check: N and M both > 0, K > 0; if N is 0, an entity in `ENTITIES` likely needs a broader keyword match against the current edition's actual headlines — inspect `app/graph.json` and adjust `ENTITIES` keyword variants, not the matching logic.)

- [ ] **Step 7: Commit**

```bash
git add scripts/build_graph.py tests/test_build_graph.py app/graph.json
git commit -m "feat: build_graph.py — story-entity graph for the Obsidian tab"
```

---

### Task 3: Add `d3-force` dependency

**Files:**
- Modify: `webapp/package.json`

**Interfaces:**
- Produces: `d3-force` importable from `webapp/src/**` as `forceSimulation`, `forceManyBody`, `forceLink`, `forceCenter`, `forceCollide`.

- [ ] **Step 1: Add the dependency**

Edit `webapp/package.json`, in `"dependencies"`:

```json
  "dependencies": {
    "d3-force": "^3.0.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
```

- [ ] **Step 2: Install**

Run: `cd webapp && npm install`
Expected: `d3-force` (and its small transitive deps: `d3-dispatch`, `d3-quadtree`, `d3-timer`) added to `node_modules` and `package-lock.json` (or `npm-shrinkwrap`/lockfile the repo uses) updated.

- [ ] **Step 3: Commit**

```bash
git add webapp/package.json webapp/package-lock.json
git commit -m "chore: add d3-force dependency for the Obsidian graph tab"
```

(If the repo has no committed lockfile yet, `git add webapp/package.json` alone and note the lockfile is gitignored — check `git status` output before committing to see which files actually changed.)

---

### Task 4: Add `catColor()` helper to `lib.js`

**Files:**
- Modify: `webapp/src/lib.js`

**Interfaces:**
- Produces: `catColor(cat: string) -> string` — a deterministic `hsl(...)` string for a given category name, same value every time for the same input.

- [ ] **Step 1: Add the helper**

Edit `webapp/src/lib.js`, add after the `examLevel` export added in the prior feature (before `CATEGORY_ORDER`):

```js
export function catColor(cat) {
  let h = 0
  const s = String(cat || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return 'hsl(' + (h % 360) + ' 65% 62%)'
}
```

- [ ] **Step 2: Manually verify determinism in the browser console**

No automated JS test suite exists in this project (webapp has no vitest/jest — only `oxlint` for linting, per `webapp/package.json`). Verify manually once the dev server is running (Task 8): open the browser console and confirm `catColor('Markets')` returns the same string on repeated calls.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib.js
git commit -m "feat: add catColor helper for graph node coloring"
```

(This is a small, low-risk addition — commit it standalone now, or fold into Task 5's commit if you prefer one commit per rendered feature. Either is fine; keeping it separate makes `git bisect` easier if a color-only issue ever shows up.)

---

### Task 5: Create `ObsidianGraph.jsx`

**Files:**
- Create: `webapp/src/components/ObsidianGraph.jsx`

**Interfaces:**
- Consumes: `graph: {nodes: [...], edges: [...]} | null` prop (shape from Task 2's `app/graph.json`); `catColor` from `webapp/src/lib.js` (Task 4)
- Produces: default export `ObsidianGraph({ graph })` React component, rendered by `App.jsx` (Task 6)

- [ ] **Step 1: Write the component**

Create `webapp/src/components/ObsidianGraph.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { catColor } from '../lib.js'

const W = 800
const H = 640
const TICKS = 300

function layout(nodes, edges) {
  const nodeCopies = nodes.map((n) => ({ ...n }))
  const linkCopies = edges.map((e) => ({ ...e }))
  const sim = forceSimulation(nodeCopies)
    .force('charge', forceManyBody().strength((d) => (d.type === 'entity' ? -220 : -90)))
    .force('link', forceLink(linkCopies).id((d) => d.id).distance(70))
    .force('center', forceCenter(W / 2, H / 2))
    .force('collide', forceCollide((d) => (d.type === 'entity' ? 10 + Math.sqrt(d.degree || 1) * 4 : 6)))
    .stop()
  for (let i = 0; i < TICKS; i++) sim.tick()
  return { nodes: nodeCopies, links: linkCopies }
}

function otherEnd(link, id) {
  const s = link.source.id || link.source
  const t = link.target.id || link.target
  return s === id ? t : (t === id ? s : null)
}

function FocusPanel({ id, nodes, links }) {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  if (node.type === 'story') {
    return (
      <div className="ofocus">
        <div className="ofocus-title">{node.label}</div>
        <a href={node.id} target="_blank" rel="noopener noreferrer" className="srcbtn">Open source</a>
      </div>
    )
  }
  const connected = links
    .filter((l) => (l.source.id || l.source) === id || (l.target.id || l.target) === id)
    .map((l) => nodes.find((n) => n.id === otherEnd(l, id)))
    .filter(Boolean)
  return (
    <div className="ofocus">
      <div className="ofocus-title">{node.label}</div>
      <ul>
        {connected.map((c) => (
          <li key={c.id}><a href={c.id} target="_blank" rel="noopener noreferrer">{c.label}</a></li>
        ))}
      </ul>
    </div>
  )
}

export default function ObsidianGraph({ graph }) {
  const [focused, setFocused] = useState(null)
  const [query, setQuery] = useState('')

  const { nodes, links } = useMemo(() => {
    if (!graph || !graph.nodes.length) return { nodes: [], links: [] }
    return layout(graph.nodes, graph.edges)
  }, [graph])

  const neighborIds = useMemo(() => {
    if (!focused) return null
    const set = new Set([focused])
    links.forEach((l) => {
      const s = l.source.id || l.source
      const t = l.target.id || l.target
      if (s === focused) set.add(t)
      if (t === focused) set.add(s)
    })
    return set
  }, [focused, links])

  const matchIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [query, nodes])

  if (!graph) return <div className="empty">Loading…</div>
  if (!nodes.length) return <div className="empty">Nothing connected yet.</div>

  const active = matchIds || neighborIds

  return (
    <div className="obsidian-wrap">
      <input
        className="gsearch"
        placeholder="Search entities or stories…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <svg viewBox={'0 0 ' + W + ' ' + H} className="ograph" onClick={() => setFocused(null)}>
        {links.map((l, i) => {
          const s = l.source, t = l.target
          const dim = active && !(active.has(s.id) && active.has(t.id))
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={'oedge' + (dim ? ' dim' : '')} />
        })}
        {nodes.map((n) => {
          const dim = active && !active.has(n.id)
          const r = n.type === 'entity' ? 6 + Math.sqrt(n.degree || 1) * 3 : 5
          return (
            <g
              key={n.id}
              className={'onode' + (dim ? ' dim' : '')}
              transform={'translate(' + n.x + ',' + n.y + ')'}
              onClick={(e) => { e.stopPropagation(); setFocused(n.id) }}
            >
              {n.type === 'entity' ? (
                <rect
                  x={-r} y={-r} width={r * 2} height={r * 2}
                  transform="rotate(45)"
                  className={'oentity' + (n.examTagged ? ' exam' : '')}
                />
              ) : (
                <circle r={r} className="ostory" style={{ fill: catColor(n.category) }} />
              )}
            </g>
          )
        })}
      </svg>
      {focused && <FocusPanel id={focused} nodes={nodes} links={links} />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/ObsidianGraph.jsx
git commit -m "feat: ObsidianGraph component — settle-once force layout as static SVG"
```

(No automated test here — this project's frontend has no JS test runner. Verification is the manual browser check in Task 8, which is where this component first actually renders against real data.)

---

### Task 6: Wire the Obsidian tab into `App.jsx`

**Files:**
- Modify: `webapp/src/App.jsx`

**Interfaces:**
- Consumes: `ObsidianGraph` default export (Task 5)
- Produces: `tab === 'obsidian'` as a valid state value alongside existing `'home'` / `'markets'` / `'glossary'`

- [ ] **Step 1: Import the component**

In `webapp/src/App.jsx`, alongside the existing `ImportantSection` import:

```js
import ObsidianGraph from './components/ObsidianGraph.jsx'
```

- [ ] **Step 2: Add graph state and fetch**

Add state near the existing `important` state:

```js
const [graph, setGraph] = useState(null)
```

Add a fetch in the same `useEffect` that fetches `important.json` on mount:

```js
useEffect(() => {
    fetch('articles.json?t=' + Date.now()).then((r) => r.json()).then(setDigest).catch((e) => setError(e.message))
    fetch('important.json?t=' + Date.now()).then((r) => r.json()).then((d) => setImportant(d.items || [])).catch(() => setImportant([]))
    fetch('graph.json?t=' + Date.now()).then((r) => r.json()).then(setGraph).catch(() => setGraph({ nodes: [], edges: [] }))
  }, [])
```

- [ ] **Step 3: Add the tab's render branch**

Replace the existing three-way `tab === 'home' ? (...) : tab === 'markets' ? (...) : (<GlossaryNebula .../>)` with a four-way chain:

```jsx
        ) : tab === 'home' ? (
          <>
            {cat === 'All' && <ImportantSection items={important} />}
            <CardFeed data={data} briefs={briefs} wire={wire} region={region} cat={cat} onOpen={(a) => openArticle(a.url)} />
          </>
        ) : tab === 'markets' ? (
          <MarketsBelt mkt={mkt} market={market} stamp={mktStamp} />
        ) : tab === 'obsidian' ? (
          <ObsidianGraph graph={graph} />
        ) : (
          <GlossaryNebula data={data} />
        )}
```

- [ ] **Step 4: Add the tab button**

In the `<nav className="tabbar">` block, add a fourth button after the "Words" button:

```jsx
          <button className={tab === 'obsidian' ? 'on' : ''} onClick={() => switchTab('obsidian')}>
            <svg viewBox="0 0 24 24">
              <path d="M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              <path d="M18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              <path d="M12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              <path d="M8 6h8M7.5 8l4 8M16.5 8l-4 8" />
            </svg>Obsidian
          </button>
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/App.jsx
git commit -m "feat: wire Obsidian tab into App.jsx"
```

---

### Task 7: Add graph styles

**Files:**
- Modify: `webapp/src/styles.css`

- [ ] **Step 1: Add the CSS**

Append after the "important (cross-edition)" block added in the prior feature:

```css
/* ---------- obsidian graph ---------- */
.obsidian-wrap { margin-top:10px; }
.ograph { width:100%; height:auto; aspect-ratio:800/640; background:var(--surface);
          border:1px solid var(--line); border-radius:16px; margin-top:12px; }
.oedge { stroke:var(--line); stroke-width:1; transition:opacity .15s var(--ease); }
.oedge.dim { opacity:.08; }
.onode { cursor:pointer; transition:opacity .15s var(--ease); }
.onode.dim { opacity:.15; }
.ostory { stroke:var(--surface); stroke-width:1.5; }
.oentity { fill:var(--muted); stroke:var(--surface); stroke-width:1.5; }
.oentity.exam { fill:var(--hot); }
.ofocus { margin-top:14px; background:var(--surface); border:1px solid var(--line);
          border-radius:14px; padding:14px 16px; }
.ofocus-title { font-family:var(--serif); font-size:16px; font-weight:600; margin-bottom:8px; }
.ofocus ul { margin:0; padding-left:18px; }
.ofocus li { font-size:13.5px; line-height:1.6; margin-bottom:4px; }
.ofocus a { color:var(--accent); text-decoration:none; }
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/styles.css
git commit -m "style: graph node/edge/focus-panel styles for the Obsidian tab"
```

---

### Task 8: Update `routine.md`, build, and verify end-to-end

**Files:**
- Modify: `routine.md`

- [ ] **Step 1: Add the `build_graph.py` step to `routine.md`**

Find the step added in the prior feature (the one that added `build_important.py` after the archive step) and add a line immediately after it:

```markdown
   Then rebuild the graph view: `python scripts/build_graph.py`
   — writes `app/graph.json` from the same qualifying pool as
   `build_important.py`, matched against a maintained entity keyword dict.
   Powers the "Obsidian" tab in the UI.
```

- [ ] **Step 2: Build the webapp bundle**

Run: `cd webapp && npm run build`
Expected: `✓ built in <time>` with no errors, `../app/index.html` and `../app/assets/*` written.

- [ ] **Step 3: Remove stale asset files**

Vite's `emptyOutDir:false` means old hashed bundle files accumulate. Run: `ls app/assets/` and delete any `.js`/`.css` files not referenced by the just-built `app/index.html` (check `app/index.html`'s `<script>`/`<link>` tags for the current hashes).

- [ ] **Step 4: Start a local server and browser-verify**

Run: `cd app && python -m http.server 8899` (background)

Using the Playwright MCP tools:
- `mcp__playwright__browser_navigate` to `http://localhost:8899`
- `mcp__playwright__browser_console_messages` with `level: "error"` — expect 0 errors
- Click the "Obsidian" tab (via `browser_snapshot` to find it, then `browser_click`)
- `mcp__playwright__browser_console_messages` again after the click — expect 0 errors
- `mcp__playwright__browser_take_screenshot` to visually confirm nodes/edges render and are not all stacked at one point (a sign the simulation didn't run/settle)
- Click a visible node (via `browser_click` on its approximate coordinates from the snapshot) and screenshot again — expect dimmed non-neighbor nodes/edges and a focus panel with a link
- `mcp__playwright__browser_resize` to 390×844 (phone) and re-screenshot — expect the graph and search box to remain usable, no horizontal overflow

- [ ] **Step 5: Run the full Python test suite one more time**

Run: `python -m pytest -q`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add routine.md app/index.html app/assets/
git commit -m "feat: wire build_graph.py into routine.md; rebuild webapp bundle"
```

- [ ] **Step 7: Push**

```bash
git push origin master
```

Confirm the GitHub Pages build picks up the new commit: `gh api repos/RawalJanak/newss/pages/builds/latest` and check `status`/`commit`.
