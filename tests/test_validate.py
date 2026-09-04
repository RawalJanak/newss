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
        "articles": articles if articles is not None
                    else [_article(url=f"https://e.com/a{i}") for i in range(12)],
        "briefs": briefs if briefs is not None else [],
        "wire": wire if wire is not None else [],
    }


def _articles(n, **over):
    """n articles with distinct urls, sharing any overrides."""
    return [_article(url=f"https://e.com/a{i}", **over) for i in range(n)]


def test_valid_document_passes():
    assert validate(_doc(), CURRICULUM) == []


def test_article_count_upper_bound_is_25():
    errs = validate(_doc(articles=_articles(26)), CURRICULUM)
    assert any("expected 12-25 articles" in e for e in errs)


def test_missing_exam_block_is_rejected():
    articles = _articles(12)
    del articles[0]["exam"]
    errs = validate(_doc(articles=articles), CURRICULUM)
    assert any("missing" in e and "exam" in e for e in errs)


def test_bad_fact_kind_is_rejected():
    errs = validate(_doc(articles=_articles(12, exam=_exam(
        relevance="medium",
        facts=[{"fact": "F", "kind": "vibes", "as_of": "2026-09-04"}],
    ))), CURRICULUM)
    assert any("invalid fact kind 'vibes'" in e for e in errs)


def test_fact_missing_as_of_is_rejected():
    errs = validate(_doc(articles=_articles(12, exam=_exam(
        relevance="medium", facts=[{"fact": "F", "kind": "date"}],
    ))), CURRICULUM)
    assert any("fact missing 'as_of'" in e for e in errs)


def test_category_not_in_curriculum_is_rejected():
    errs = validate(_doc(articles=_articles(
        12, exam=_exam(relevance="medium", categories=["Made Up Row"])
    )), CURRICULUM)
    assert any("unknown curriculum category" in e for e in errs)


def test_category_check_degrades_to_warning_when_curriculum_absent():
    errs = validate(_doc(articles=_articles(
        12, exam=_exam(relevance="medium", categories=["Made Up Row"])
    )), set())
    assert not any("unknown curriculum category" in e for e in errs)


def test_high_relevance_requires_well_formed_drill():
    errs = validate(_doc(articles=_articles(12, exam=_exam(
        relevance="high",
        drill={"q": "Q", "options": ["a", "b"], "answer": 1},
    ))), CURRICULUM)
    assert any("drill needs exactly 4 options" in e for e in errs)


def test_drill_answer_must_be_1_indexed_within_range():
    errs = validate(_doc(articles=_articles(12, exam=_exam(
        relevance="high",
        drill={"q": "Q", "options": ["a", "b", "c", "d"], "answer": 0},
    ))), CURRICULUM)
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
        "source": "S", "url": "https://e.com/a0", "exam": _exam(),
    }
    errs = validate(_doc(briefs=[b]), CURRICULUM)
    assert any("duplicate url" in e for e in errs)
