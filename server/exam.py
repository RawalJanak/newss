"""Exam-layer helpers for the AAI study integration.

Owns the closed fact taxonomy, loads category labels from the study repo's
GK curriculum, and auto-tags wire-tier items. Deep and brief exam blocks are
hand-authored during the digest build; only wire is classified here.
"""
from __future__ import annotations

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
