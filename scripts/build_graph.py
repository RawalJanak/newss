# -*- coding: utf-8 -*-
"""Build app/graph.json: a story<->entity node-link graph across all editions.

Reuses build_important.collect()'s qualifying-item pool (importance=="high",
top_story, or exam.relevance in high/medium) across archive/*.json plus the
current edition. Each qualifying item is matched against a maintained entity
keyword dict; items with zero matches are dropped (no isolated story nodes).
Run after build_important.py, before commit.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_important as bi  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IST = timezone(timedelta(hours=5, minutes=30))

# Three kinds of hub, same matching mechanism (exact-phrase, case-insensitive
# substring) -- the kind only documents *why* a name is here, it has no
# effect on matching or graph structure.
#
#   org/person/country -- a named actor that recurs across unrelated stories
#   storyline          -- an ongoing crisis/dispute/chokepoint with its own
#                         name, generating near-daily coverage over weeks
#   event              -- a dated, time-boxed happening covered by many
#                         independent stories
#
# All match by distinctive phrase, not single common words, so a match is
# never a coincidental word-repeat -- "Strait of Hormuz" or "Asian Games"
# can't accidentally appear inside an unrelated story the way a bare word
# like "summit" could.
ENTITIES = {
    # -- org / person / country --
    "RBI": ["RBI", "Reserve Bank of India"],
    "SEBI": ["SEBI"],
    "Fed": ["Federal Reserve", "the Fed", "Fed's", "Fed hikes", "Fed rate"],
    "BOJ": ["Bank of Japan", "BOJ"],
    "Tata Sons": ["Tata Sons", "Tata Group", "Tata Trusts", "N Chandrasekaran", "Noel Tata"],
    "Tata Chemicals": ["Tata Chemicals"],
    "Tata Electronics": ["Tata Electronics"],
    "Anthropic": ["Anthropic", "Claude", "Dario Amodei"],
    "OpenAI": ["OpenAI", "Sam Altman", "ChatGPT"],
    "Nexperia": ["Nexperia"],
    "Moody's": ["Moody's"],
    "Trump": ["Trump"],
    "Xi Jinping": ["Xi Jinping", "President Xi"],
    "Amazon": ["Amazon"],
    "Microsoft": ["Microsoft"],
    "Meta": ["Meta"],
    "Google": ["Google", "DeepMind", "Gemini"],
    "IMF": ["IMF"],
    "WTO": ["WTO"],
    "Iran": ["Iran", "Iranian"],
    "Saudi Arabia": ["Saudi Arabia", "Saudi", "Aramco", "Riyadh"],
    "Houthi": ["Houthi", "Houthis"],
    "China": ["China", "Chinese"],
    "US Treasury": ["Treasury Secretary", "Scott Bessent"],
    "SEC": [" SEC ", "SEC unveiled", "US SEC"],
    "NaBFID": ["NaBFID"],
    "CBDT": ["CBDT"],
    "GlobalFoundries": ["GlobalFoundries"],
    "Marvell": ["Marvell"],
    "Micron": ["Micron"],
    "King Charles": ["King Charles"],
    "Nvidia": ["Nvidia"],
    "ICC": ["International Criminal Court", " ICC "],
    "Ukraine-Russia war": ["Ukraine", "Moscow", "Zelensky", "Kyiv"],

    # -- ongoing storyline --
    "Strait of Hormuz": ["Strait of Hormuz", "Hormuz"],
    "US-Iran war": ["US-Iran war", "war with Iran", "Iran war"],
    "UPI MDR": ["UPI MDR", "MDR on UPI", "merchant discount rate"],
    "AI safety slowdown debate": ["pace the frontier", "slowdown in AI development", "AI development slow"],
    "Tata Sons IPO": ["Tata Sons IPO", "Tata Sons' IPO"],

    # -- named event --
    "Asian Games": ["Asian Games"],
    "BRICS Summit": ["BRICS Summit", "BRICS"],
    "UN General Assembly": ["UN General Assembly", "United Nations General Assembly"],
    "G20 Summit": ["G20 Summit", "G20"],
    "Union Budget": ["Union Budget"],
}


def match_entities(text):
    t = " " + (text or "").lower() + " "
    matches = []
    for name, keywords in ENTITIES.items():
        if any(kw.lower() in t for kw in keywords):
            matches.append(name)
    return sorted(matches)


def build_graph(editions):
    by_url = {}
    for ed in editions:
        for item in bi.collect(ed):
            existing = by_url.get(item["url"])
            if not existing or (item["date"] or "") > (existing["date"] or ""):
                by_url[item["url"]] = item

    story_nodes = []
    edges = []
    entity_degree = {}
    entity_exam_tagged = {}

    for item in by_url.values():
        haystack = (item.get("title") or "") + " " + (item.get("text") or "")
        matches = match_entities(haystack)
        if not matches:
            continue

        story_nodes.append({
            "id": item["url"],
            "type": "story",
            "label": item["title"],
            "text": item.get("text") or "",
            "category": item.get("category"),
            "exam": item.get("exam") or {"relevance": "none", "categories": []},
            "date": item.get("date"),
            "importance": item.get("importance"),
            "top_story": bool(item.get("top_story")),
        })

        has_categories = bool((item.get("exam") or {}).get("categories"))
        for name in matches:
            edges.append({"source": item["url"], "target": name})
            entity_degree[name] = entity_degree.get(name, 0) + 1
            if has_categories:
                entity_exam_tagged[name] = True

    entity_nodes = [
        {
            "id": name,
            "type": "entity",
            "label": name,
            "degree": degree,
            "examTagged": entity_exam_tagged.get(name, False),
        }
        for name, degree in entity_degree.items()
    ]

    return {"nodes": story_nodes + entity_nodes, "edges": edges}


def main():
    files = sorted(ROOT.glob("archive/*.json"))
    editions = [json.load(open(p, encoding="utf-8")) for p in files]
    current = ROOT / "app" / "articles.json"
    if current.exists():
        editions.append(json.load(open(current, encoding="utf-8")))

    graph = build_graph(editions)
    graph["generated_at"] = datetime.now(IST).isoformat()

    (ROOT / "app" / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    story_count = sum(1 for n in graph["nodes"] if n["type"] == "story")
    entity_count = sum(1 for n in graph["nodes"] if n["type"] == "entity")
    print("graph.json: %d story nodes, %d entity nodes, %d edges from %d editions" % (
        story_count, entity_count, len(graph["edges"]), len(editions)
    ))


if __name__ == "__main__":
    main()
