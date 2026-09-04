from pathlib import Path

from server.exam import (
    FACT_KINDS,
    RELEVANCE,
    WIRE_RELEVANCE,
    build_wire_exam,
    load_curriculum_labels,
    should_promote,
    tag_wire_category,
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


def test_tag_wire_category_detects_sport():
    assert tag_wire_category(
        "India beat Australia by 6 wickets to win the ODI series"
    ) == "Sports — records, terminology, tournaments"


def test_tag_wire_category_detects_appointment():
    assert tag_wire_category(
        "Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman"
    ) == "Current affairs — recent appointments/schemes/awards (India, live)"


def test_tag_wire_category_returns_none_for_unmatched():
    assert tag_wire_category("Sensex rebounds 730 points in early trade") is None


def test_should_promote_flags_appointments():
    assert should_promote("Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman")


def test_should_promote_flags_awards_records_and_obituaries():
    assert should_promote("Indian shooter sets world record in Cairo")
    assert should_promote("Veteran playwright passes away at 88")
    assert should_promote("Scientist conferred Padma Bhushan")


def test_should_promote_ignores_routine_market_headlines():
    assert not should_promote("Sensex rebounds 730 points as Waller cools hike bets")
    assert not should_promote("Gold slips Rs 431 ahead of US payrolls")


def test_should_promote_flags_scheme_launches():
    assert should_promote("Government announces launch of PM RAHAT scheme")


def test_should_promote_ignores_ponzi_scheme_false_positive():
    assert not should_promote("Investors lose crores in Ponzi scheme")


def test_tag_wire_category_matches_plural_medals():
    assert tag_wire_category(
        "India wins gold medals at Asian Games"
    ) == "Sports — records, terminology, tournaments"


def test_tag_wire_category_matches_plural_odis():
    assert tag_wire_category(
        "Kohli scores century in ODIs"
    ) == "Sports — records, terminology, tournaments"


def test_tag_wire_category_matches_plural_medals_short():
    assert tag_wire_category(
        "Two medals for India"
    ) == "Sports — records, terminology, tournaments"


def test_tag_wire_category_does_not_match_odi_inside_commodity():
    assert tag_wire_category(
        "Gold prices rise as commodity markets rally"
    ) != "Sports — records, terminology, tournaments"


def test_tag_wire_category_does_not_match_trophy_inside_atrophy():
    assert tag_wire_category(
        "Doctors study muscle atrophy in long-duration astronauts"
    ) != "Sports — records, terminology, tournaments"


def test_build_wire_exam_shape():
    block = build_wire_exam("Ashok Kumar Lahiri appointed NITI Aayog Vice Chairman")
    assert block["relevance"] == "unscored"
    assert block["promote"] is True
    assert block["facts"] == []
    assert block["drill"] is None
    assert block["categories"] == [
        "Current affairs — recent appointments/schemes/awards (India, live)"
    ]


def test_build_wire_exam_empty_categories_when_unmatched():
    block = build_wire_exam("Sensex rebounds 730 points in early trade")
    assert block["categories"] == []
    assert block["promote"] is False
