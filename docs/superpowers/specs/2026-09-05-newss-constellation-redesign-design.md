# newss Constellation Redesign — Design Spec

Status: approved by user 2026-09-05, ready for implementation plan.

## 1. Problem

The portal was ported from a vanilla single-file app into React 1:1 (same
dark-green card layout, same tabs) with an R3F hero blob bolted on. The user
does not want a port — they want the whole visual language, layout, and
navigation model rethought, explicitly rejecting the current color theme.

## 2. Decisions (locked via brainstorming + visual companion)

- **Visual language**: "Playful Reactive" (Resn-style) — saturated shapes,
  cursor-reactive motion, hover-expand/highlight on everything, scroll-driven
  reveals. Full WebGL cursor-reactive shapes (not just CSS/Framer Motion),
  accepting the higher GPU/battery cost this implies.
- **Palette**: "Violet Night" — deep purple-black base, electric
  lavender/pink/mint/amber accents. Zero reuse of the current
  green/near-black (`--accent:#3FD98B`, `--bg:#0B100E`) theme.
- **Information architecture**: "Constellation" — home is a pannable/
  scrollable 3D starfield, not a card list or tabs. No bottom tab bar.
- **Scope**: full restructure, not a reskin. Screens, navigation, and content
  organization all change. The underlying data pipeline and contract
  (`app/articles.json`, `app/markets.json`, three-tier model, exam-rail
  schema) are explicitly **out of scope** — this is a `webapp/` frontend-only
  redesign.

## 3. Visual system

### Palette (CSS custom properties, replacing the current `:root` block)

```
--bg-0: #0C0914;         /* deepest background */
--bg-1: #15111F;         /* base panel */
--bg-2: #2A2140;         /* ink card */
--line: #3A2E55;
--ink: #F1ECFF;
--muted: #9C8FC4;
--faint: #6B5F8F;

--violet: #B084FF;       /* primary accent — Markets/general */
--pink:   #FF6FB3;       /* India / lead story */
--mint:   #00E6C3;       /* Sports / exam */
--amber:  #FFD166;       /* AI / Business */
--coral:  #FF8A65;       /* World / Geopolitics */

--glow-violet: rgba(176,132,255,.45);
--glow-pink:   rgba(255,111,179,.45);
```

Each article `category` maps to one accent color (fixed table in code, not
inferred) — this becomes each star's color. `importance:"high"` or
`top_story:true` increases star size and glow radius; nothing else changes
size to avoid a second competing signal.

### Typography

Keep `Newsreader` serif for headlines (reads fine on dark violet) — increase
size/leading for the more editorial, spacious feel this style calls for.
Sans stack (system) unchanged for UI chrome.

### Motion principles

- Idle: stars drift gently (slow Perlin/sine offset), dust particles
  drift slower and dimmer.
- Hover/pointer-near: nearest stars bulge/glow toward the cursor
  (vertex displacement or scale+glow, whichever profiles better — decided
  during implementation, not this spec).
- Scroll: camera pans/zooms through the starfield; parallax between star
  layer and dust layer.
- Click: camera flies to the target star (eased dolly-in), star expands and
  cross-fades into the 2D article reader panel.
- `prefers-reduced-motion`: disable drift/bulge/parallax, keep static
  layout and instant (non-eased) transitions. This is not optional —
  same hard requirement as the current site.

## 4. Information architecture

### 4.1 Three zones of one sky

Instead of Home/Markets/Glossary tabs, one continuous camera space with
three named regions the user pans/zooms between:

1. **News sky** (default view) — the 15 deep articles as stars.
2. **Markets belt** — index tiles and mover tables, rendered as a denser
   asteroid-belt-style band (still 2D tables under the hood; the "belt"
   framing is a camera position + background treatment, not a new data
   view).
3. **Glossary nebula** — every unique term as a small glowing point;
   zooming in reveals term/definition, exactly like today's search list
   but rendered inside the same canvas language instead of a separate page.

A persistent minimap or region-switcher in the corner shows which of the
three regions the camera is in and lets a click/tap snap to any of them —
this is the **replacement for the bottom tab bar** and must remain even
under reduced-motion (snap, not fly, in that case).

### 4.2 Star tiers (mapping the three-tier data model)

| Data tier | Render |
|---|---|
| `articles` (15, deep) | Individual 3D star mesh, colored by category, sized by importance, clickable |
| `briefs` (45) | Dust particles clustered near their category's stars; brightens on zoom-in; opens a lightweight 2D card (not a full reader) on click |
| `wire` (~350) | Background dust field, dimmest tier, only a count + "N more" affordance near each cluster — same "more stories today" disclosure the current site has, just spatial instead of a `<details>` |

This tiering exists because rendering 350+ individual interactive meshes is
both a performance problem and a legibility problem — the dust metaphor is
the answer, not a compromise; treat it as load-bearing, not decorative.

### 4.3 Filtering — "gravity drag"

A row of small category blobs sits along one edge of the canvas (one per
category present in the current data, same category set as today:
Markets, India, World, Sports, Exam, etc.). Dragging one toward the center
of the canvas increases that category's gravitational pull in the
simulation: its stars/dust drift closer and brighten; everything else
dims and drifts outward. Releasing lets the pull decay back to neutral
over a few seconds (not instant) so the motion itself communicates the
filter changing, not just the end state.

This replaces the current `.pills` region/category filter row. On mobile
(see 4.5) this becomes a plain tap-to-filter chip row — the drag metaphor
is desktop-only.

### 4.4 Article reader

Unchanged content and schema (title, tags/confidence, simple/plain-English
list, key numbers, glossary terms, full body, sources, exam rail). What
changes is presentation and entry: the reader is now a 2D panel that the
clicked star morphs/cross-fades into (camera stops moving once the panel is
open — no 3D behind an open reader, to keep reading calm and on-brand with
"most of the drama is spent getting somewhere, not while reading"). Exam
rail keeps its current two-column desktop layout and content, restyled to
the new palette only.

### 4.5 Mobile fallback

Full drag-physics constellation is a desktop-pointer interaction and does
not translate to touch well (drag conflicts with scroll). On viewports
<760px:

- Replace the pannable 3D canvas with a vertical-scroll list of the same
  stars, still rendered as glowing circular cards (same colors/sizes,
  same category-to-color mapping) so the visual identity carries over,
  but reachable by normal scroll instead of camera pan.
- Tapping a star still does a (shorter, cheaper) fly-in/cross-fade into
  the reader.
- Category filter becomes a horizontal tap-chip row (visually styled as
  the same blobs, no drag).
- Region switcher (News/Markets/Glossary) becomes a fixed small pill
  toggle instead of a minimap.
- Dust tiers (briefs/wire) render as plain lightweight lists under each
  relevant section, not as particle fields — particle rendering at that
  density is a phone GPU/battery risk with no reading benefit.

## 5. Technical approach

- Keep `webapp/` (Vite + React + `@react-three/fiber` + `@react-three/drei`)
  as the base — this redesign replaces `App.jsx`/`Home.jsx`/`styles.css`
  content, not the toolchain.
- New dependencies: `@react-three/postprocessing` (glow/bloom) and
  `framer-motion` (2D chrome: reader panel transitions, chip row, minimap)
  are both justified by this design — add only these, nothing else,
  per the project's existing "add only what's used" discipline.
- Stars: individual `<mesh>` per article (15 max) — cheap.
- Dust: one `InstancedMesh` (or `Points`) per tier (briefs, wire) — not
  one mesh per item. This is the load-bearing performance decision from
  §4.2 and must not be relaxed during implementation.
- Camera: a single `PerspectiveCamera` driven by a small state machine
  (idle drift → focused-on-star → reader-open → region-transition), not
  ad hoc position tweens scattered across components.
- Device capability check on mount (e.g. `navigator.hardwareConcurrency`,
  viewport width, `prefers-reduced-motion`) selects: full 3D / reduced 3D
  (fewer dust particles, no bloom) / mobile list fallback. Same content,
  three render budgets.

## 6. Explicitly out of scope

- Any change to `server/`, `scripts/`, `routine.md`'s data pipeline, or the
  `articles.json`/`markets.json` schema.
- Phase 2 (question-bank review queue) and Phase 3 (buzz/social layer)
  from the earlier exam-layer work — unrelated to this visual redesign.
- Rewriting article content, exam facts, or the verification protocol.

## 7. Risks accepted (stated, not hidden)

- Full WebGL cursor-reactive shapes are heavier than the current single
  decorative blob; mitigated by the three-tier render budget in §5, but
  low-end devices will still see a visibly simpler experience by design,
  not by accident.
- A starfield/constellation metaphor is a genuinely unconventional way to
  browse news; discoverability (how does a first-time visitor know to
  drag a category blob, or that dust is clickable-when-zoomed) needs
  explicit onboarding treatment (a one-time hint overlay) — flagged here
  so the implementation plan includes it rather than discovering the gap
  during build.
