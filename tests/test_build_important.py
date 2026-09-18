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
