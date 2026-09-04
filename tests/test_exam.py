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
