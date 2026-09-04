#!/usr/bin/env python3
"""Validate app/articles.json against the three-tier digest schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
ARTICLES = ROOT / "app" / "articles.json"

from server.exam import (  # noqa: E402
    FACT_KINDS,
    RELEVANCE,
    WIRE_RELEVANCE,
    load_curriculum_labels,
)

CATEGORIES = {
    "Markets", "Economy & Policy", "Business", "Startups", "AI", "Innovation",
    "Geopolitics", "India", "Aviation", "World", "Analysis",
    "Sports", "Entertainment", "Science", "Education", "Government", "Exam",
}
CONFIDENCE = {
    "primary", "corroborated", "thin", "single",
    "verified", "single_sourced", "rumour",   # legacy
}
EDITIONS = {"morning", "evening"}
REQUIRED_ARTICLE = {
    "title", "summary", "body", "category", "source", "url",
    "published", "top_story", "confidence", "exam",
}
REQUIRED_BRIEF = {"text", "category", "date", "source", "url", "exam"}
REQUIRED_WIRE = {"title", "source", "url", "published", "category", "exam"}


def _check_exam(exam, prefix, curriculum, errors, *, wire=False):
    """Validate one exam block. `curriculum` empty means the check is skipped."""
    if not isinstance(exam, dict):
        errors.append(f"{prefix}: exam must be an object")
        return

    relevance = exam.get("relevance")
    if wire:
        if relevance != WIRE_RELEVANCE:
            errors.append(f"{prefix}: wire relevance must be '{WIRE_RELEVANCE}'")
        if exam.get("facts"):
            errors.append(f"{prefix}: wire item must not carry facts")
        if exam.get("drill") is not None:
            errors.append(f"{prefix}: wire item must not carry drill")
    elif relevance not in RELEVANCE:
        errors.append(f"{prefix}: relevance must be one of {sorted(RELEVANCE)}")

    for label in exam.get("categories") or []:
        # Empty curriculum == study repo absent; degrade to skip, never fail.
        if curriculum and label not in curriculum:
            errors.append(f"{prefix}: unknown curriculum category {label!r}")

    for j, fact in enumerate(exam.get("facts") or []):
        fp = f"{prefix}.facts[{j}]"
        if not fact.get("fact"):
            errors.append(f"{fp}: fact missing 'fact'")
        if fact.get("kind") not in FACT_KINDS:
            errors.append(f"{fp}: invalid fact kind {fact.get('kind')!r}")
        if not fact.get("as_of"):
            errors.append(f"{fp}: fact missing 'as_of'")

    drill = exam.get("drill")
    if relevance == "high" and drill is not None:
        options = drill.get("options") or []
        if len(options) != 4:
            errors.append(f"{prefix}: drill needs exactly 4 options, got {len(options)}")
        answer = drill.get("answer")
        if not isinstance(answer, int) or not 1 <= answer <= 4:
            errors.append(f"{prefix}: drill answer must be 1-4, got {answer!r}")
        if not drill.get("q"):
            errors.append(f"{prefix}: drill missing 'q'")


def validate(data: dict, curriculum: set[str] | None = None) -> list[str]:
    errors: list[str] = []
    if curriculum is None:
        curriculum = load_curriculum_labels()

    if "generated_at" not in data:
        errors.append("missing generated_at")
    if data.get("edition") not in EDITIONS:
        errors.append(f"edition must be one of {sorted(EDITIONS)}")

    articles = data.get("articles")
    if not isinstance(articles, list):
        errors.append("articles must be a list")
        return errors

    if not (12 <= len(articles) <= 25):
        errors.append(f"expected 12-25 articles, got {len(articles)}")

    top = sum(1 for a in articles if a.get("top_story"))
    if top > 5:
        errors.append(f"max 5 top_story items, got {top}")

    seen_urls: set[str] = set()

    def _dedupe(url, prefix):
        if not url:
            return
        if url in seen_urls:
            errors.append(f"{prefix}: duplicate url {url}")
        seen_urls.add(url)

    for i, a in enumerate(articles):
        prefix = f"articles[{i}]"
        missing = REQUIRED_ARTICLE - set(a)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        if a.get("category") not in CATEGORIES:
            errors.append(f"{prefix}: invalid category {a.get('category')!r}")
        if a.get("confidence") not in CONFIDENCE:
            errors.append(f"{prefix}: confidence must be one of {sorted(CONFIDENCE)}")
        if not a.get("url", "").startswith("http"):
            errors.append(f"{prefix}: invalid url")
        body_words = len(a.get("body", "").split())
        if body_words < 200:
            errors.append(f"{prefix}: body too short ({body_words} words)")
        _dedupe(a.get("url"), prefix)
        if "exam" in a:
            _check_exam(a["exam"], prefix, curriculum, errors)

    briefs = data.get("briefs") or []
    if not isinstance(briefs, list):
        errors.append("briefs must be a list")
        briefs = []
    if len(briefs) > 80:
        errors.append(f"expected at most 80 briefs, got {len(briefs)}")
    for i, b in enumerate(briefs):
        prefix = f"briefs[{i}]"
        missing = REQUIRED_BRIEF - set(b)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        if b.get("category") not in CATEGORIES:
            errors.append(f"{prefix}: invalid category {b.get('category')!r}")
        _dedupe(b.get("url"), prefix)
        if "exam" in b:
            _check_exam(b["exam"], prefix, curriculum, errors)

    wire = data.get("wire") or []
    if not isinstance(wire, list):
        errors.append("wire must be a list")
        wire = []
    if len(wire) > 600:
        errors.append(f"expected at most 600 wire items, got {len(wire)}")
    for i, w in enumerate(wire):
        prefix = f"wire[{i}]"
        missing = REQUIRED_WIRE - set(w)
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        _dedupe(w.get("url"), prefix)
        if "exam" in w:
            _check_exam(w["exam"], prefix, curriculum, errors, wire=True)

    return errors


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ARTICLES
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(
        f"OK: {len(data['articles'])} articles, "
        f"{len(data.get('briefs') or [])} briefs, "
        f"{len(data.get('wire') or [])} wire, "
        f"edition={data.get('edition')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
