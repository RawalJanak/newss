# -*- coding: utf-8 -*-
"""Aggregate important + AAI-exam-relevant items across all editions into app/important.json.

Scans archive/*.json (past editions) and app/articles.json (current edition).
An item qualifies if importance=="high", or top_story==True (articles), or
exam.relevance in ("high", "medium"). Deduped by url, keeping the newest
occurrence. Run after the archive step, before commit.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def qualifies(item, kind):
    if item.get("importance") == "high":
        return True
    if kind == "article" and item.get("top_story"):
        return True
    exam = item.get("exam") or {}
    return exam.get("relevance") in ("high", "medium")


def edition_date(edition):
    return edition.get("generated_at", "")


def collect(edition):
    out = []
    date = edition_date(edition)
    for kind, key, date_field in (("article", "articles", "published"), ("brief", "briefs", "date"), ("wire", "wire", "published")):
        for item in edition.get(key, []):
            if not qualifies(item, kind):
                continue
            url = item.get("url")
            if not url:
                continue
            out.append({
                "title": item.get("title") or item.get("text"),
                "url": url,
                "source": item.get("source"),
                "category": item.get("category"),
                "date": item.get(date_field) or date,
                "kind": kind,
                "importance": item.get("importance"),
                "top_story": bool(item.get("top_story")),
                "exam": item.get("exam") or {"relevance": "none"},
            })
    return out


def main():
    files = sorted(ROOT.glob("archive/*.json"))
    editions = [json.load(open(p, encoding="utf-8")) for p in files]
    current = ROOT / "app" / "articles.json"
    if current.exists():
        editions.append(json.load(open(current, encoding="utf-8")))

    by_url = {}
    for ed in editions:
        for item in collect(ed):
            existing = by_url.get(item["url"])
            if not existing or (item["date"] or "") > (existing["date"] or ""):
                by_url[item["url"]] = item

    items = sorted(by_url.values(), key=lambda x: x["date"] or "", reverse=True)[:150]
    out = {"items": items}
    (ROOT / "app" / "important.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print("important.json: %d items from %d editions" % (len(items), len(editions)))


if __name__ == "__main__":
    main()
