import importlib.util
import tempfile
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


def _article(url, title, summary="", importance="high", top_story=False, exam=None, category="Markets",
             published="2026-09-18T09:00:00+05:30"):
    return {
        "title": title, "url": url, "source": "ET", "category": category,
        "published": published, "importance": importance,
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
        articles=[_article("https://e.com/a3", "RBI old headline", "RBI news.",
                            published="2026-09-10T09:00:00+05:30")],
        generated_at="2026-09-10T09:00:00+05:30",
    )
    new_edition = _edition(
        articles=[_article("https://e.com/a3", "RBI new headline", "RBI news.",
                            published="2026-09-18T09:00:00+05:30")],
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
        build_graph_mod.write_vault_notes(graph, vault_root)
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
        slug1 = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        slug2 = build_graph_mod.story_slug("RBI holds steady", "https://e.com/a2")
        assert ("[[stories/%s]]" % slug1) in content
        assert ("[[stories/%s]]" % slug2) in content
        assert content.index("2026-09-24") < content.index("2026-09-23")


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


def test_read_vault_graph_skips_undecodable_note_without_crashing(capsys):
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        (vault_root / "stories").mkdir(parents=True)
        (vault_root / "entities").mkdir(parents=True)
        (vault_root / "stories" / "bad-bytes.md").write_bytes(b"\xff\xfe not valid utf-8")
        parsed = build_graph_mod.read_vault_graph(vault_root)
        assert parsed["nodes"] == []
        assert "bad-bytes.md" in capsys.readouterr().out


def test_write_vault_notes_title_change_same_url_does_not_duplicate_bullet_or_node():
    with tempfile.TemporaryDirectory() as tmp:
        vault_root = Path(tmp)
        graph_v1 = _graph_with_one_story()
        build_graph_mod.write_vault_notes(graph_v1, vault_root)

        graph_v2 = {
            "nodes": [
                {
                    "id": "https://e.com/a1", "type": "story",
                    "label": "RBI hikes rates by 25bps", "text": "The RBI raised the repo rate by 25bps.",
                    "category": "Markets", "date": "2026-09-23",
                    "importance": "high", "top_story": True,
                    "exam": {"relevance": "high", "categories": ["Economy & Banking bodies"]},
                },
                {"id": "RBI", "type": "entity", "label": "RBI", "degree": 1, "examTagged": True},
            ],
            "edges": [{"source": "https://e.com/a1", "target": "RBI"}],
        }
        build_graph_mod.write_vault_notes(graph_v2, vault_root)

        old_slug = build_graph_mod.story_slug("RBI hikes rates", "https://e.com/a1")
        new_slug = build_graph_mod.story_slug("RBI hikes rates by 25bps", "https://e.com/a1")
        assert not (vault_root / "stories" / (old_slug + ".md")).exists()
        assert (vault_root / "stories" / (new_slug + ".md")).exists()

        entity_content = (vault_root / "entities" / "rbi.md").read_text(encoding="utf-8")
        assert entity_content.count("[[stories/") == 1
        assert new_slug in entity_content
        assert old_slug not in entity_content

        parsed = build_graph_mod.read_vault_graph(vault_root)
        story_ids = [n["id"] for n in parsed["nodes"] if n["type"] == "story"]
        assert story_ids == ["https://e.com/a1"]
