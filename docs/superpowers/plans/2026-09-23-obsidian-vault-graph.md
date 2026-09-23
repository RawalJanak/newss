# Obsidian Vault Graph Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real Obsidian.md vault at `TOMORROW/wiki/` the source of truth for the dashboard's "Obsidian" graph tab, instead of `app/graph.json` being computed straight from entity-matching in one pass.

**Architecture:** `scripts/build_graph.py`'s existing `build_graph()` (pure, entity-matching, already tested) stays unchanged and produces an in-memory `{nodes, edges}` graph as today. Two new pure functions are added around it: `write_vault_notes(graph, vault_root)` renders that graph into markdown notes under `wiki/entities/` and `wiki/stories/` (idempotent, append-only history on entity notes), and `read_vault_graph(vault_root)` parses those same notes back into `{nodes, edges}`. `main()` is rewired to run `build_graph()` → `write_vault_notes()` → `read_vault_graph()` → write `app/graph.json` from the *parsed* result, so the JSON the dashboard reads is now literally derived from vault content.

**Tech Stack:** Python stdlib only (`re`, `hashlib`, `json`, `pathlib`) — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-23-obsidian-vault-graph-design.md`

## Global Constraints

- No new dependencies — stdlib only (`re`, `hashlib`, `json`, `pathlib`, `datetime`).
- `build_graph()`'s existing signature and behavior are unchanged — existing tests in `tests/test_build_graph.py` must keep passing untouched.
- Vault path is `TOMORROW/wiki/` — i.e. `ROOT.parent / "wiki"` where `ROOT` is the `newss` project root (`scripts/build_graph.py`'s existing `ROOT = Path(__file__).resolve().parent.parent`).
- Entity note writes are append-only (never delete/rewrite existing bullets, only add new ones and re-sort); story note writes are full overwrites (derived purely from current data, nothing to preserve).
- `app/graph.json`'s output shape must stay `{nodes, edges, generated_at}` with the same node/edge field names `ObsidianGraph.jsx` already reads — `id, type, label, text, category, exam, date, importance, top_story` for story nodes; `id, type, label, degree, examTagged` for entity nodes.

## Review Focus

- **Re-running the same edition twice** must not duplicate bullets in an entity note or corrupt story notes — a person re-running `routine.md` after a failed push expects identical output, not growing files.
- **A story matching zero entities** (as today) must not create empty vault notes or crash `write_vault_notes` — it simply produces no story/entity notes for that item, same as `build_graph()` already drops it from the graph.
- **A hand-edited or malformed vault note** (bad frontmatter, missing `url`) must not crash the whole read pass — skip that one note with a printed warning, keep parsing the rest, so a person's manual vault edit doesn't take down the entire pipeline.
- **Two different stories with the same title** (e.g. wire syndication, same headline from two editions) must not collide into the same story note — the story slug must be unique per URL, not per title.
- **An entity whose vault note was hand-deleted or never existed yet** must get created fresh on the next run, not raise `FileNotFoundError` — first-touch entities are the common case for the first vault run ever.

---

## Task 1: Slug helpers

**Files:**
- Modify: `scripts/build_graph.py` (add near top, after `ENTITIES` dict, ~line 86)
- Test: `tests/test_build_graph.py` (add new test functions at end)

**Interfaces:**
- Produces: `slugify(text: str) -> str`, `entity_slug(name: str) -> str`, `story_slug(title: str, url: str) -> str` — used by Task 2 and Task 3.

- [ ] **Step 1: Write the failing tests**

```python
def test_slugify_lowercases_and_dashes():
    assert build_graph_mod.slugify("Tata Sons IPO") == "tata-sons-ipo"


def test_slugify_strips_leading_trailing_punctuation():
    assert build_graph_mod.slugify("  US Treasury! ") == "us-treasury"


def test_entity_slug_matches_slugify():
    assert build_graph_mod.entity_slug("BOJ") == "boj"


def test_story_slug_is_stable_for_same_url():
    a = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
    b = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
    assert a == b


def test_story_slug_differs_for_same_title_different_url():
    a = build_graph_mod.story_slug("Markets close higher", "https://e.com/a1")
    b = build_graph_mod.story_slug("Markets close higher", "https://e.com/a2")
    assert a != b
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_build_graph.py -k slug -v`
Expected: FAIL with `AttributeError: module 'build_graph' has no attribute 'slugify'`

- [ ] **Step 3: Implement the slug helpers**

Add to `scripts/build_graph.py` right after the `ENTITIES` dict (before `def match_entities`):

```python
import hashlib
import re


def slugify(text):
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text or "").strip("-").lower()
    return text or "untitled"


def entity_slug(name):
    return slugify(name)


def story_slug(title, url):
    base = slugify(title)[:60].strip("-") or "story"
    digest = hashlib.md5(url.encode("utf-8")).hexdigest()[:6]
    return "%s-%s" % (base, digest)
```

Also add `import hashlib` and `import re` to the top-of-file import block (lines 10-13) instead of inline if preferred — keep all imports at the top of the file, standard placement.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_build_graph.py -k slug -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/build_graph.py tests/test_build_graph.py
git commit -m "feat: add slug helpers for vault note filenames"
```

---

## Task 2: Write pass — `write_vault_notes`

**Files:**
- Modify: `scripts/build_graph.py` (add after Task 1's helpers, before `def build_graph`)
- Test: `tests/test_build_graph.py`

**Interfaces:**
- Consumes: `graph = {"nodes": [...], "edges": [...]}` in the exact shape `build_graph()` already returns (story nodes have `id, type, label, text, category, exam, date, importance, top_story`; entity nodes have `id, type, label, degree, examTagged`); `slugify`, `entity_slug`, `story_slug` from Task 1; module-level `ENTITIES` dict for alias lookup.
- Produces: `write_vault_notes(graph: dict, vault_root: Path) -> None` — writes files under `vault_root / "entities"` and `vault_root / "stories"`. Used by Task 4's `main()`.

- [ ] **Step 1: Write the failing tests**

```python
import tempfile


def _graph_with_one_story():
    return {
        "nodes": [
            {
                "id": "https://e.com/a1", "type": "story",
                "label": "RBI hikes rates", "text": "The RBI raised the repo rate.",
                "category": "Markets", "date": "2026-09-23",
                "importance": "high", "top_story": True,
                "exam": {"relevance": "high", "categories": ["Economy & Banking bodies"]},
            },
            {"id": "RBI", "type": "entity", "label": "RBI", "degree": 1, "examTagged": True},
        ],
        "edges": [{"source": "https://e.com/a1", "target": "RBI"}],
    }


def test_write_vault_notes_creates_story_note_with_connection():
    graph = _graph_with_one_story()
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        build_graph_mod.write_vault_notes(graph, vault_root)
        slug = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        content = (vault_root / "stories" / (slug + ".md")).read_text(encoding="utf-8")
        assert "url: https://e.com/a1" in content
        assert "top_story: true" in content
        assert "exam_relevance: high" in content
        assert "[[entities/rbi]]" in content


def test_write_vault_notes_creates_entity_note_with_bullet():
    graph = _graph_with_one_story()
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        build_graph_mod.write_vault_notes(graph, vault_root)
        content = (vault_root / "entities" / "rbi.md").read_text(encoding="utf-8")
        slug = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        assert "examTagged: true" in content
        assert ("[[stories/%s]]" % slug) in content
        assert "2026-09-23" in content


def test_write_vault_notes_is_idempotent_no_duplicate_bullets():
    graph = _graph_with_one_story()
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        build_graph_mod.write_vault_notes(graph, vault_root)
        build_graph_mod.write_vault_notes(graph, vault_root)  # run twice
        content = (vault_root / "entities" / "rbi.md").read_text(encoding="utf-8")
        slug = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        assert content.count("[[stories/%s]]" % slug) == 1


def test_write_vault_notes_appends_second_story_to_existing_entity_note():
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        build_graph_mod.write_vault_notes(_graph_with_one_story(), vault_root)
        graph2 = {
            "nodes": [
                {
                    "id": "https://e.com/a2", "type": "story",
                    "label": "RBI holds steady", "text": "The RBI held rates.",
                    "category": "Markets", "date": "2026-09-24",
                    "importance": "medium", "top_story": False,
                    "exam": {"relevance": "none", "categories": []},
                },
                {"id": "RBI", "type": "entity", "label": "RBI", "degree": 1, "examTagged": False},
            ],
            "edges": [{"source": "https://e.com/a2", "target": "RBI"}],
        }
        build_graph_mod.write_vault_notes(graph2, vault_root)
        content = (vault_root / "entities" / "rbi.md").read_text(encoding="utf-8")
        assert "RBI hikes rates" not in content  # bullet gist uses label; only newest kept? see step 3
        slug1 = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        slug2 = build_graph_mod.story_slug("RBI holds steady", "https://e.com/a2")
        assert ("[[stories/%s]]" % slug1) in content
        assert ("[[stories/%s]]" % slug2) in content
        # newest date listed first (reverse-chronological)
        assert content.index("2026-09-24") < content.index("2026-09-23")
```

Note: the third assertion in the last test (`"RBI hikes rates" not in content`) is wrong — delete that line before running; it was a slip while drafting. The real assertions are the two `assert ... in content` slug checks plus the ordering check.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_build_graph.py -k write_vault_notes -v`
Expected: FAIL with `AttributeError: module 'build_graph' has no attribute 'write_vault_notes'`

- [ ] **Step 3: Implement `write_vault_notes`**

Add to `scripts/build_graph.py` after the Task 1 helpers, before `def build_graph`:

```python
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)
ENTITY_BULLET_RE = re.compile(
    r"^- (\d{4}-\d{2}-\d{2}): \[\[stories/([^\]]+)\]\] — (.*)$", re.MULTILINE
)


def _parse_frontmatter(content):
    m = FRONTMATTER_RE.match(content)
    if not m:
        return {}, content
    fm_text, body = m.groups()
    fm = {}
    for line in fm_text.splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        fm[key.strip()] = val.strip()
    return fm, body


def _render_story_note(item, connections):
    fm_lines = [
        "title: %s" % item.get("label", ""),
        "date: %s" % (item.get("date") or ""),
        "category: %s" % (item.get("category") or ""),
        "importance: %s" % (item.get("importance") or ""),
        "top_story: %s" % ("true" if item.get("top_story") else "false"),
        "exam_relevance: %s" % ((item.get("exam") or {}).get("relevance") or "none"),
        "exam_categories: %s" % "; ".join((item.get("exam") or {}).get("categories") or []),
        "url: %s" % item["id"],
    ]
    fm = "---\n" + "\n".join(fm_lines) + "\n---\n"
    body = (item.get("text") or "").strip() + "\n\n## Connections\n"
    body += "\n".join("- [[entities/%s]]" % entity_slug(e) for e in connections)
    return fm + body + "\n"


def _render_entity_note(name, aliases, exam_tagged, bullets):
    fm = "---\ntype: entity\naliases: %s\nexamTagged: %s\n---\n" % (
        json.dumps(aliases), "true" if exam_tagged else "false"
    )
    heading = "# %s\n\n" % name
    bullet_lines = "\n".join(
        "- %s: [[stories/%s]] — %s" % (date, slug, gist)
        for date, slug, gist in bullets
    )
    return fm + heading + bullet_lines + "\n"


def write_vault_notes(graph, vault_root):
    entities_dir = vault_root / "entities"
    stories_dir = vault_root / "stories"
    entities_dir.mkdir(parents=True, exist_ok=True)
    stories_dir.mkdir(parents=True, exist_ok=True)

    story_nodes = {n["id"]: n for n in graph["nodes"] if n["type"] == "story"}
    entity_nodes = {n["id"]: n for n in graph["nodes"] if n["type"] == "entity"}

    entity_to_stories = {}
    for edge in graph["edges"]:
        entity_to_stories.setdefault(edge["target"], []).append(edge["source"])

    slug_by_story = {
        story_id: story_slug(item["label"], story_id)
        for story_id, item in story_nodes.items()
    }

    story_to_entities = {}
    for entity_name, story_ids in entity_to_stories.items():
        for sid in story_ids:
            story_to_entities.setdefault(sid, []).append(entity_name)

    for story_id, item in story_nodes.items():
        slug = slug_by_story[story_id]
        connections = sorted(story_to_entities.get(story_id, []))
        content = _render_story_note(item, connections)
        (stories_dir / (slug + ".md")).write_text(content, encoding="utf-8")

    for name, story_ids in entity_to_stories.items():
        path = entities_dir / (entity_slug(name) + ".md")
        existing_bullets = []
        if path.exists():
            _, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
            existing_bullets = list(ENTITY_BULLET_RE.findall(body))
        existing_slugs = {b[1] for b in existing_bullets}

        for story_id in story_ids:
            slug = slug_by_story[story_id]
            if slug in existing_slugs:
                continue
            item = story_nodes[story_id]
            existing_bullets.append((item.get("date") or "", slug, item.get("label") or ""))
            existing_slugs.add(slug)

        existing_bullets.sort(key=lambda b: b[0], reverse=True)
        entity_node = entity_nodes.get(name, {"examTagged": False})
        aliases = ENTITIES.get(name, [name])
        content = _render_entity_note(name, aliases, entity_node["examTagged"], existing_bullets)
        path.write_text(content, encoding="utf-8")
```

Also add `import json` to the top of the file if not already imported (it already is, line 10 — no change needed there).

- [ ] **Step 4: Run tests to verify they pass**

Fix the drafting slip in the last test (delete the wrong assertion line) before running.

Run: `python -m pytest tests/test_build_graph.py -k write_vault_notes -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/build_graph.py tests/test_build_graph.py
git commit -m "feat: write vault notes from graph (entity history, story connections)"
```

---

## Task 3: Read pass — `read_vault_graph`

**Files:**
- Modify: `scripts/build_graph.py` (add after `write_vault_notes`)
- Test: `tests/test_build_graph.py`

**Interfaces:**
- Consumes: `_parse_frontmatter`, `ENTITY_BULLET_RE` from Task 2; vault directory layout `write_vault_notes` produces.
- Produces: `read_vault_graph(vault_root: Path) -> {"nodes": [...], "edges": [...]}` — used by Task 4's `main()`. Output node/edge shape matches what `ObsidianGraph.jsx` already consumes.

- [ ] **Step 1: Write the failing tests**

```python
def test_read_vault_graph_round_trips_write_vault_notes():
    graph = _graph_with_one_story()
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        build_graph_mod.write_vault_notes(graph, vault_root)
        parsed = build_graph_mod.read_vault_graph(vault_root)

        story_nodes = [n for n in parsed["nodes"] if n["type"] == "story"]
        entity_nodes = [n for n in parsed["nodes"] if n["type"] == "entity"]
        assert story_nodes[0]["id"] == "https://e.com/a1"
        assert story_nodes[0]["label"] == "RBI hikes rates"
        assert story_nodes[0]["top_story"] is True
        assert story_nodes[0]["exam"]["relevance"] == "high"
        assert story_nodes[0]["exam"]["categories"] == ["Economy & Banking bodies"]
        assert entity_nodes[0]["id"] == "RBI"
        assert entity_nodes[0]["examTagged"] is True
        assert parsed["edges"] == [{"source": "https://e.com/a1", "target": "RBI"}]


def test_read_vault_graph_returns_empty_for_missing_vault_dirs():
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp) / "does-not-exist"
        parsed = build_graph_mod.read_vault_graph(vault_root)
        assert parsed == {"nodes": [], "edges": []}


def test_read_vault_graph_skips_malformed_story_note(capsys):
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        (vault_root / "stories").mkdir(parents=True)
        (vault_root / "entities").mkdir(parents=True)
        (vault_root / "stories" / "broken.md").write_text("not valid frontmatter at all", encoding="utf-8")
        parsed = build_graph_mod.read_vault_graph(vault_root)
        assert parsed["nodes"] == []
        assert "broken.md" in capsys.readouterr().out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_build_graph.py -k read_vault_graph -v`
Expected: FAIL with `AttributeError: module 'build_graph' has no attribute 'read_vault_graph'`

- [ ] **Step 3: Implement `read_vault_graph`**

Add to `scripts/build_graph.py` after `write_vault_notes`:

```python
CONNECTION_RE = re.compile(r"\[\[entities/([^\]]+)\]\]")


def read_vault_graph(vault_root):
    entities_dir = vault_root / "entities"
    stories_dir = vault_root / "stories"
    nodes = []
    edges = []

    slug_to_name = {}
    if entities_dir.exists():
        for path in sorted(entities_dir.glob("*.md")):
            content = path.read_text(encoding="utf-8")
            fm, body = _parse_frontmatter(content)
            if not fm:
                print("build_graph: skipping malformed entity note %s" % path.name)
                continue
            heading = re.search(r"^# (.+)$", body, re.MULTILINE)
            name = heading.group(1).strip() if heading else path.stem
            degree = len(ENTITY_BULLET_RE.findall(body))
            exam_tagged = fm.get("examTagged", "false").strip().lower() == "true"
            slug_to_name[path.stem] = name
            nodes.append({
                "id": name, "type": "entity", "label": name,
                "degree": degree, "examTagged": exam_tagged,
            })

    if stories_dir.exists():
        for path in sorted(stories_dir.glob("*.md")):
            content = path.read_text(encoding="utf-8")
            fm, body = _parse_frontmatter(content)
            if not fm or "url" not in fm:
                print("build_graph: skipping malformed story note %s" % path.name)
                continue
            parts = body.split("## Connections", 1)
            text = parts[0].strip()
            conn_body = parts[1] if len(parts) > 1 else ""
            categories_raw = fm.get("exam_categories", "")
            categories = [c.strip() for c in categories_raw.split(";") if c.strip()]
            nodes.append({
                "id": fm["url"], "type": "story",
                "label": fm.get("title", fm["url"]), "text": text,
                "category": fm.get("category") or None,
                "exam": {
                    "relevance": fm.get("exam_relevance", "none"),
                    "categories": categories,
                },
                "date": fm.get("date") or None,
                "importance": fm.get("importance") or None,
                "top_story": fm.get("top_story", "false").strip().lower() == "true",
            })
            for entity_slug_match in CONNECTION_RE.findall(conn_body):
                name = slug_to_name.get(entity_slug_match)
                if name:
                    edges.append({"source": fm["url"], "target": name})

    return {"nodes": nodes, "edges": edges}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_build_graph.py -k read_vault_graph -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add scripts/build_graph.py tests/test_build_graph.py
git commit -m "feat: read vault notes back into graph.json shape"
```

---

## Task 4: Wire `main()` through the vault, verify against the real vault

**Files:**
- Modify: `scripts/build_graph.py:149-166` (the `main()` function)

**Interfaces:**
- Consumes: `build_graph`, `write_vault_notes`, `read_vault_graph` — all now defined in this file.
- Produces: `app/graph.json` on disk, and populated `TOMORROW/wiki/entities/*.md` + `TOMORROW/wiki/stories/*.md` — the deliverable the dashboard and Obsidian both read.

- [ ] **Step 1: Rewrite `main()`**

Replace the current `main()` body (`scripts/build_graph.py:149-166`):

```python
VAULT = ROOT.parent / "wiki"


def main():
    files = sorted(ROOT.glob("archive/*.json"))
    editions = [json.load(open(p, encoding="utf-8")) for p in files]
    current = ROOT / "app" / "articles.json"
    if current.exists():
        editions.append(json.load(open(current, encoding="utf-8")))

    graph = build_graph(editions)
    write_vault_notes(graph, VAULT)
    vault_graph = read_vault_graph(VAULT)
    vault_graph["generated_at"] = datetime.now(IST).isoformat()

    (ROOT / "app" / "graph.json").write_text(
        json.dumps(vault_graph, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    story_count = sum(1 for n in vault_graph["nodes"] if n["type"] == "story")
    entity_count = sum(1 for n in vault_graph["nodes"] if n["type"] == "entity")
    print("graph.json: %d story nodes, %d entity nodes, %d edges from %d editions (via vault)" % (
        story_count, entity_count, len(vault_graph["edges"]), len(editions)
    ))
```

This replaces the old direct `graph["generated_at"] = ...` / write pattern — the write now happens on `vault_graph` (the read-back-from-vault result), not the raw `build_graph()` output.

- [ ] **Step 2: Run the full test suite**

Run: `python -m pytest -q`
Expected: all tests pass, including the untouched `test_build_graph_creates_story_and_entity_nodes` etc. (those test `build_graph()` directly, which didn't change) plus every new test from Tasks 1-3.

- [ ] **Step 3: Run against the real vault and inspect output**

```bash
python scripts/build_graph.py
```

Then check:
- `TOMORROW/wiki/entities/` now has one `.md` file per entity that appeared in any archived or current edition, each with a bulleted history.
- `TOMORROW/wiki/stories/` has one `.md` file per qualifying story, each with a `## Connections` section.
- `app/graph.json` has the same node/edge counts as before this change (compare the printed count against a `git stash` + re-run of the old script, or just sanity-check the counts look right — should not be zero if archive/current editions have qualifying stories).
- Open the vault in the actual Obsidian app (if available) and confirm the graph view shows linked notes.

- [ ] **Step 4: Rebuild the dashboard bundle and manually verify the tab still renders**

```bash
cd webapp && npm run build
```

Then open `app/index.html` (or the dev server) in a browser, click the "Obsidian" tab, and confirm it renders identically to before — same nodes, same labels, same AAI/Top flags, same timeline popups on click. This is a visual-parity check, not a new feature — the component didn't change, only its data source did.

- [ ] **Step 5: Run `routine.md` end-to-end once to confirm the pipeline step still fits**

The existing `routine.md` step ("Then rebuild the graph view... `python scripts/build_graph.py`") needs no wording change — it already just says to run this script. Confirm by re-reading `routine.md`'s graph step that nothing there references internals that changed (it doesn't — it only names the script and describes what it powers).

- [ ] **Step 6: Commit**

```bash
git add scripts/build_graph.py
git commit -m "feat: wire build_graph main() through the vault write/read passes"
```

If `TOMORROW/wiki/` content should also be committed (it lives one level up from the `newss` git repo, at the `TOMORROW/` root) — check whether `TOMORROW/` itself is a separate git repo or untracked; if it's outside `newss`'s repo, the vault notes are not part of this commit and don't need `git add` here at all. Confirm with `git -C "C:\Users\jmraw\OneDrive\Desktop\TOMORROW" status` before assuming either way.
