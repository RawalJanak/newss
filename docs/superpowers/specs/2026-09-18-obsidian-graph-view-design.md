# newss — Obsidian graph view

*Design doc · 18 September 2026 · revision 1*

## Problem

The digest publishes stories as flat lists — Home's card feed, the new Important
section, briefs, wire — but never shows how stories relate to each other. Recurring
entities (RBI, Tata Sons, the Fed, Anthropic) drive multiple stories across multiple
editions, and that connective structure is currently invisible: reading it requires
holding the whole archive in your head. Janak wants a fourth tab, "Obsidian", that
surfaces those connections as an interactive node-link graph — the same shape as
Obsidian's own graph view — so the connections themselves become the view, not
something inferred while reading prose.

## Goal

Analyze every qualifying story across the current edition and the archive, extract
the entities each one mentions, and render a graph where entity nodes pull together
the stories that share them — visually clustering, for example, the Tata Sons IPO
dispute, the Nexperia partnership and the Dholera plant story around a "Tata Sons"
hub, without anyone having to have read all three to notice they're connected.

## Non-goals

- Free-form NLP / named-entity recognition. Entities come from a maintained keyword
  list, the same mechanical pattern as `build_wire_exam`'s category tagging — not a
  model call, not per-edition authoring work.
- Story-to-story or story-to-category edges. Category is already a filter on Home;
  the graph's job is the entity layer that has no other home in the UI today.
- Live/continuously-animated force simulation. The simulation runs once per build,
  settles, and the frontend renders the settled layout — matching the lesson from the
  3D constellation redesign (`2026-09-05-newss-constellation-redesign-design.md`),
  which was reverted for being unreadable at real content volume.
- Editing the graph from the UI. Read-only, like every other tab.

## Design

### 1. Node pool and qualification

Reuses the qualifying-item filter already defined in `scripts/build_important.py`
(`importance=="high"` OR `top_story` OR `exam.relevance` in `high`/`medium`), applied
across `archive/*.json` + the current `app/articles.json`. This is a deliberate reuse,
not a new filter — it keeps the graph's node count bounded to the same "the stories
that matter" pool already surfaced in Important, rather than all 400 wire items times
N editions. Feeding the full wire tier in would produce the illegible hairball the
constellation redesign already failed with.

### 2. Entity list and matching

A maintained Python dict in `scripts/build_graph.py`:

```python
ENTITIES = {
    "RBI": ["RBI", "Reserve Bank of India"],
    "Fed": ["Federal Reserve", "the Fed"],
    "Tata Sons": ["Tata Sons"],
    "Anthropic": ["Anthropic", "Claude"],
    # ... ~50-80 entries at launch
}
```

Matching is case-insensitive substring search against each qualifying item's `title`
(+ `summary` when present — briefs and wire don't have one, articles do). One match
is enough to create the edge; no scoring, no weighting.

The list starts with the recurring names visible across the archive editions written
so far (RBI, Fed, BOJ, Tata Sons, Anthropic, OpenAI, Nexperia, Moody's, Trump, Xi,
etc.) and grows by adding dict entries as new recurring names appear in future
editions — the same low-maintenance-list pattern the wire promotion matcher already
uses for exam-signal phrases.

### 3. Graph construction and output

`scripts/build_graph.py`, run after `build_important.py`:

1. Collect qualifying items (§1) from every `archive/*.json` + current edition,
   deduped by `url` (same dedup rule as `build_important.py` — newest occurrence
   wins).
2. For each item, match against `ENTITIES` (§2). An item with zero matches is
   dropped — no isolated story nodes with nothing to connect to.
3. Build two node sets:
   - **story nodes** — `{id: url, type: "story", label: title, category, exam,
     date, importance, top_story}`
   - **entity nodes** — `{id: entity name, type: "entity", label: entity name,
     degree: count of connected stories, examTagged: true if any connected story's
     exam.categories references an AAI curriculum row}`
4. Edges: `{source: story url, target: entity name}` for every match.
5. Write `app/graph.json`: `{generated_at, nodes: [...], edges: [...]}`.

No physics/layout computation happens in Python — node *data* is emitted un-laid-out;
the frontend runs the force simulation once on load.

### 4. Rendering

New dependency: `d3-force` (physics-only module, no DOM/SVG rendering code bundled —
that stays hand-written, consistent with the project's existing "plain CSS, no heavy
UI framework" constraint from the post-constellation rebuild).

New `webapp/src/components/ObsidianGraph.jsx`:

- On mount, builds a `d3-force` simulation (`forceManyBody` repulsion, `forceLink` on
  the entity edges, `forceCenter`) over the nodes/edges from `graph.json`.
- Runs the simulation synchronously to convergence (`simulation.stop()` after a fixed
  tick count, not `requestAnimationFrame`-driven forever) — settles once, renders
  static positions. No continuous animation loop to fight with the browser's paint
  budget on a phone, which is the same class of problem that made the constellation
  view unreadable.
- Renders the settled graph as plain SVG: `<circle>` per node, `<line>` per edge.
  - Story nodes: radius small/fixed, fill color by `category` (reuses the same
    category→color association implied by the existing `.cat` accent styling).
  - Entity nodes: radius scales with `degree` (more connected stories = bigger hub),
    diamond marker instead of circle, amber (`--hot`) fill when `examTagged`.

### 5. Interaction

- Click a node → sets a `focused` id in component state. Neighbors (1 hop) get full
  opacity + a highlight stroke; everything else fades to ~15% opacity. Click the
  background to clear focus.
- Side panel on focus: a story node shows title + "open source" link (same external
  link pattern as `ImportantSection`); an entity node shows its label + a list of
  connected story titles/links.
- A text search box above the graph filters visually the same way a click does
  (matches focused, rest faded) rather than removing nodes — keeps the overall shape
  of the graph visible even while searching.
- No category/entity filter chips at launch (open question in Testing below) — full
  graph renders on open, per the explicit "see it all at once" requirement.

### 6. Wiring

- Fourth tab "Obsidian" added to `webapp/src/App.jsx`'s `tabbar`, next to Home /
  Markets / Words, following the existing `tab === 'x'` conditional-render pattern.
- `App.jsx` fetches `graph.json` the same way it fetches `important.json` — on mount,
  independent of which tab is active, so switching to Obsidian doesn't show a loading
  flash for data that could've been ready already.
- `routine.md` step 7 gains a second sub-step: `python scripts/build_graph.py` runs
  immediately after `build_important.py`, every edition.

## Data flow

```
archive/*.json + app/articles.json
        │
        ▼
scripts/build_important.py ──► app/important.json   (existing, unchanged)
        │
        ▼
scripts/build_graph.py
   1. same qualifying-item pool as build_important.py
   2. match against ENTITIES keyword dict
   3. drop items with zero entity matches
   4. emit story nodes + entity nodes + story-entity edges
        │
        ▼
app/graph.json
        │
        ▼
webapp: ObsidianGraph.jsx
   - d3-force simulation, settle once
   - render static SVG nodes/edges
   - click-to-focus + search
```

## Testing

- Unit test for `ENTITIES` matching: a fixture item list with known entity mentions,
  asserting expected edges and that a non-matching item produces no story node
  (fixture-based, same style as the existing wire-promotion-matcher test called out in
  the exam-layer spec).
- Unit test for dedup-by-url-keep-newest, mirroring the existing behavior in
  `build_important.py`.
- Manual browser check: graph renders with 0 console errors, settles within a couple
  seconds on the current archive size, click-to-focus dims non-neighbors, search
  narrows focus without nodes disappearing. Checked at the same three breakpoints used
  for the exam-layer rail (390px / 1079px / 1600px) since a force-graph is exactly the
  kind of view that can silently break on a phone width.
- Watch node/edge count as archive grows across editions — if it becomes visually
  dense enough to need filter chips (category or "last N editions only"), that's an
  explicit follow-up, not pre-built now (YAGNI; noted as an open question below, not a
  requirement).

## Risks

| Risk | Handling |
|---|---|
| Entity list is incomplete at launch, so early graphs look sparse | Starts with names already recurring across the 5 archived editions; list grows by adding dict entries as new names recur — no migration needed since `build_graph.py` reruns from source data every edition |
| Graph becomes visually dense as more editions accumulate | Node pool is already bounded to the important-items filter (§1), not all wire; if it's still too dense later, add a category/entity filter or a "last N editions" cutoff — explicitly deferred, not solved now |
| `d3-force` is a new runtime dependency | Physics-only module (no rendering, no DOM management) — smallest possible surface; `webapp/package.json` currently has only `react`/`react-dom` as runtime deps, so this is a deliberate, isolated addition, not the start of a larger dependency pull |
| Repeating the constellation redesign's failure mode (over-complex, unreadable at volume) | Simulation settles once and renders static SVG rather than a live/animated/3D scene; node pool bounded by §1; explicitly checked against real archive volume in Testing, not just an empty-state mockup |

## Sequencing

Single phase — pipeline script, frontend component, tab wiring, all land together
since none is independently useful without the others (a graph tab with no data
pipeline, or a pipeline with no UI, serves nobody).
