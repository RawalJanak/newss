# Obsidian vault graph → dashboard integration

## Goal

The dashboard's "Obsidian" tab currently renders a node-link graph computed
in-memory each edition by `scripts/build_graph.py`, matching qualifying
stories against a hardcoded `ENTITIES` dict and writing the result straight
to `app/graph.json`. Nothing persists outside that one JSON file — there is
no real Obsidian vault content, and no accumulated per-entity history you
can browse.

This integrates the real Obsidian.md vault already set up at
`TOMORROW/` (`.obsidian/`, `wiki/`, per `TOMORROW/CLAUDE.md`) as the actual
home for that knowledge, and makes it the source of truth the dashboard
graph is generated from — so opening the vault in Obsidian shows the same
entities with their full accumulated history, and the dashboard tab stays
visually unchanged but is now backed by real notes instead of a
recomputed-from-scratch JSON blob.

## Architecture

`scripts/build_graph.py` splits into two passes. Both run every edition,
same mandatory step already wired into `routine.md`.

### Pass 1 — Write (entity matching → vault notes)

Reuses the existing entity-matching logic unchanged: the `ENTITIES` dict
(org/person/country, storyline, named-event hub kinds) matched
case-insensitive exact-phrase against each qualifying story's title +
summary. The taxonomy — what counts as an entity, its aliases — stays in
this Python dict; editing a dict to add a new entity is simpler than
restructuring vault files for it.

For each match, write/update two kinds of markdown notes:

- **Entity note** — `TOMORROW/wiki/entities/<slug>.md`
  ```md
  ---
  type: org
  aliases: [Tata Group, Tata Trusts, N Chandrasekaran, Noel Tata]
  examTagged: false
  ---

  # Tata Sons

  - 2026-09-23: [[stories/tata-sons-ipo-filing]] — RBI clears IPO filing timeline
  - 2026-09-21: [[stories/tata-sons-chairman]] — chairman succession confirmed
  ```
  Reverse-chronological, one bullet per story that touched this entity.

- **Story note** — `TOMORROW/wiki/stories/<slug>.md`
  ```md
  ---
  date: 2026-09-23
  category: Business
  importance: high
  url: https://...
  ---

  <story's existing `summary` field, unchanged>

  ## Connections
  - [[entities/tata-sons]]
  - [[entities/rbi]]
  ```
  The `## Connections` section is the only part the read-pass looks at for
  edges — everything else is for humans/Obsidian, not parsed.

**Idempotency:** before appending a bullet to an entity note, check whether
that story's slug already appears in the note body; skip if so. Re-running
an edition, or running the digest twice on the same stories, must not
duplicate history. The read-pass never mutates the vault, so it's always
safe to re-run standalone.

**Write mechanism:** plain Python file I/O (`open(path, 'a')` /
read-modify-write), not the claude-obsidian plugin's own mutation tools.
The WSL requirement noted in `TOMORROW/CLAUDE.md` (native Windows `apply`
calls failing with `UNSUPPORTED_PLATFORM`) applies to that plugin's own
commands, not to a script writing markdown files directly — this pipeline
runs natively on Windows same as the rest of `routine.md`.

### Pass 2 — Read (vault → graph.json)

A new function parses every note under `wiki/entities/` and `wiki/stories/`:

- Entity notes → graph nodes (`{id, type, label, degree, examTagged}`,
  `degree` = number of bullets, `examTagged` from frontmatter).
- Story notes' `## Connections` section → edges (story → entity, one edge
  per `[[wikilink]]` listed there).

Output shape is unchanged from today's `app/graph.json` — same
`{nodes, edges}` structure `ObsidianGraph.jsx` already consumes. The
dashboard component itself needs **no changes**; only where the JSON comes
from changes (parsed from vault markdown instead of computed in the same
pass as the matching).

## Data flow

```
routine.md step 7 (unchanged position)
  → build_graph.py
      Pass 1: qualifying stories + ENTITIES dict → write/update wiki/entities/*.md, wiki/stories/*.md
      Pass 2: parse wiki/entities/*.md + wiki/stories/*.md → app/graph.json
  → dashboard "Obsidian" tab reads app/graph.json (unchanged component)
```

## Error handling

- Vault directory missing (`TOMORROW/wiki/` not found) → hard error, same
  as today's behavior if `build_graph.py` can't write `app/graph.json` —
  don't silently skip and leave the tab stale.
- A story note with no `## Connections` section (matched no entities) →
  valid, just produces no edges for that story; not an error.
- Malformed frontmatter in a hand-edited vault note → skip that note with
  a warning printed to the routine's report, don't crash the whole pass.

## Testing

- Unit test the write pass: given a story + entity match, assert the
  correct bullet is appended, and assert re-running is a no-op (idempotency).
- Unit test the read pass: given fixture vault notes, assert the parsed
  `graph.json` matches expected `{nodes, edges}`.
- Existing `ObsidianGraph.jsx` tests (if any) untouched — output shape is
  unchanged.

## Out of scope (deferred)

- Gap-detection / catch-up research for missed editions, and vault-driven
  story continuity across gaps — a separate, previously-discussed design,
  not part of this integration. This spec only covers vault ↔ dashboard
  graph wiring.
- Any change to the map/network toggle feature (`ObsidianMap.jsx`,
  `graphShared.jsx`, `worldMap.js`) — explicitly deferred by the user,
  untouched here.
- Populating the vault with anything beyond news entities/stories (other
  TOMORROW subprojects, personal notes) — user confirmed news-only scope.
