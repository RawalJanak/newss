#!/usr/bin/env python3
"""Validate app/articles.json against the digest schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "app" / "articles.json"

CATEGORIES = {
    "Markets",
    "Economy & Policy",
    "Business",
    "Startups",
    "AI",
    "Innovation",
    "Geopolitics",
    "India",
    "Aviation",
    "World",
    "Analysis",
}
# Computed tiers from scripts/corroborate.py, which counts how many independent
# publishers carry a story. The three legacy values were asserted by hand and stay
# valid so older editions still validate.
CONFIDENCE = {
    "primary",        # a primary source (RBI, SEBI, filing) is in the cluster
    "corroborated",   # 3+ independent publishers
    "thin",           # exactly 2
    "single",         # 1
    "verified", "single_sourced", "rumour",   # legacy
}
EDITIONS = {"morning", "evening"}
REQUIRED_ARTICLE = {
    "title",
    "summary",
    "body",
    "category",
    "source",
    "url",
    "published",
    "top_story",
    "confidence",
}


def validate(data: dict) -> list[str]:
    errors: list[str] = []

    if "generated_at" not in data:
        errors.append("missing generated_at")
    if data.get("edition") not in EDITIONS:
        errors.append(f"edition must be one of {sorted(EDITIONS)}")

    articles = data.get("articles")
    if not isinstance(articles, list):
        errors.append("articles must be a list")
        return errors

    if not (10 <= len(articles) <= 20):
        errors.append(f"expected 10–20 articles, got {len(articles)}")

    top = sum(1 for a in articles if a.get("top_story"))
    if top > 5:
        errors.append(f"max 5 top_story items, got {top}")

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

    return errors


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ARTICLES
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = validate(data)
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(data['articles'])} articles, edition={data.get('edition')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
