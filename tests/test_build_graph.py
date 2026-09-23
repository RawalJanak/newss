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
