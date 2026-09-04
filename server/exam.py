"""Exam-layer helpers for the AAI study integration.

Owns the closed fact taxonomy, loads category labels from the study repo's
GK curriculum, and auto-tags wire-tier items. Deep and brief exam blocks are
hand-authored during the digest build; only wire is classified here.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Closed taxonomy. Closed so facts can be drilled by type later — "name the
#: officeholder" is a different exercise from "recall the number".
FACT_KINDS = frozenset({
    "officeholder", "date", "number", "award", "scheme",
    "record", "place", "book", "obituary", "body",
})

#: Relevance values for hand-authored tiers.
RELEVANCE = frozenset({"high", "medium", "none"})

#: Wire items are machine-tagged, never hand-read, so they get their own value.
WIRE_RELEVANCE = "unscored"

#: The study repo sits beside TOMORROW/ on this machine. Absence is tolerated.
CURRICULUM_PATH = ROOT.parent.parent / "AAI" / "GK_CURRICULUM.md"

_CATEGORY_HEADING = "## category status"


def load_curriculum_labels(path: Path = CURRICULUM_PATH) -> set[str]:
    """Return the category row labels from GK_CURRICULUM.md's status table.

    Only the table under '## Category status' is read — the session-log table
    further down has dates in its first column, which are not labels.

    Returns an empty set if the file is absent so that `newss` stays
    independently buildable when cloned without the study repo.
    """
    if not path.exists():
        return set()

    labels: set[str] = set()
    in_section = False

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            in_section = line.lower().startswith(_CATEGORY_HEADING)
            continue
        if not in_section or not line.startswith("|"):
            continue

        cells = [c.strip() for c in line.strip("|").split("|")]
        if not cells:
            continue
        label = cells[0]
        if not label or label == "Category" or set(label) <= set("-: "):
            continue
        labels.add(label)

    return labels


#: Keyword sets per curriculum row. Labels here MUST match GK_CURRICULUM.md
#: verbatim — the validator rejects anything that does not.
CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Sports — records, terminology, tournaments": (
        "cricket", "odi", "t20", "test match", "world cup", "olympic",
        "tournament", "championship", "medal", "trophy", "fifa",
        "badminton", "chess", "hockey", "wickets", "innings",
    ),
    "Awards & Honours (Bharat Ratna, Padma, Khel Ratna, Nobel)": (
        "padma", "bharat ratna", "nobel", "khel ratna", "laureate",
        "conferred", "honoured with",
    ),
    "Current affairs — rolling officeholders (CEC, VP/RS Chair, UN SG, etc.)": (
        "chief election commissioner", "vice president", "chief justice",
        "un secretary-general", "rbi governor", "cabinet secretary",
    ),
    "Current affairs — recent appointments/schemes/awards (India, live)": (
        "appointed", "appoints", "sworn in", "takes charge",
        "yojana", "scheme", "mission launched",
    ),
    "Economy & Banking bodies (RBI, SEBI, NABARD, IBRD, IMF, etc.)": (
        "rbi", "sebi", "nabard", "imf", "world bank", "repo rate",
        "monetary policy",
    ),
    "Books & Authors": ("memoir", "author", "book launched"),
    "Science — Pioneers & discoveries (vaccines, inventions, laws)": (
        "isro", "satellite", "launch vehicle", "vaccine", "spacecraft",
    ),
}

#: Headline shapes that signal an examinable fact. Deliberately excludes bare
#: "index" and "rise/fall", which match routine market copy.
PROMOTE_PATTERNS: tuple[str, ...] = (
    "appointed", "appoints", "sworn in", "takes charge", "takes over as",
    "conferred", "honoured with", "wins award", "awarded",
    "launches scheme", "launch of", "inaugurates", "unveils",
    "sets record", "breaks record", "world record",
    "passes away", "dies at", "dead at",
    "ranked", "tops the list",
    "summit", "signs mou", "signs agreement",
    "clinches", "lifts the title", "wins the title",
)


def tag_wire_category(title: str) -> str | None:
    """Best-effort curriculum category for a wire headline.

    Scores each category by keyword hits and returns the leader, or None when
    nothing matches. Lower quality than hand-authoring by design — wire items
    are barred from the question bank until promoted and hand-verified.
    """
    text = title.lower()
    best: str | None = None
    best_hits = 0
    for label, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for k in keywords if re.search(r'\b' + re.escape(k) + r's?\b', text))
        if hits > best_hits:
            best, best_hits = label, hits
    return best


def should_promote(title: str) -> bool:
    """True when a headline looks like it carries an examinable fact.

    Promoted wire items become the candidate pool for the next edition's brief
    tier, so brief selection is pre-filtered instead of hand-scanned.
    """
    text = title.lower()
    return any(p in text for p in PROMOTE_PATTERNS)


def build_wire_exam(title: str) -> dict:
    """The complete `exam` block for a wire-tier item."""
    category = tag_wire_category(title)
    return {
        "relevance": WIRE_RELEVANCE,
        "categories": [category] if category else [],
        "facts": [],
        "drill": None,
        "promote": should_promote(title),
    }
