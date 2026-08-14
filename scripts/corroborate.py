# -*- coding: utf-8 -*-
"""Fetch every feed, cluster the same story across publishers, rank by corroboration.

The point: `routine.md` mandates "two independent outlets" as a verification tier, but nothing
measured it. This does. A story carried by six publishers is a different object from one carried
by a single outlet, and the reader should be able to see which is which.

Counting rules that keep the number honest:
  - Publishers, not feeds. ET Markets + ET Economy + ET Tech is ONE voice.
  - Aggregators (Google News) never count. They republish the outlets already being counted.
  - Newsletters never count. Analysis is not independent confirmation of a fact.
  - A primary source (RBI, SEBI) in the cluster outranks any number of secondary reports.

Run from the repo root:  python scripts/corroborate.py [--hours 30] [--min-cluster 1]
Writes _clusters.json for the next stage; prints a ranked table for review.
"""
import argparse
import datetime
import io
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.feeds import parse_feed  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

STOP = set("""
a an the and or but of in on at to for from with by as is are was were be been being it its this
that these those has have had will would could should may might can new says say said after
before over under about into out up down more most other some such no nor not only own same so
than too very s t just don now amid ahead here s how why what when who which he she they them his
her their our your my i you we us also vs via live update updates explained explainer key top
latest news report reports first second third
""".split())

BOILER = re.compile(
    r"\b(live updates?|live blog|explained|explainer|here'?s (why|what|how)|watch|video|photos?|"
    r"opinion|analysis|exclusive|breaking|full text|highlights?|read more)\b", re.I)

NUM = re.compile(r"\d[\d,\.]*")


def toks(title):
    """Content words + numeric tokens for a headline."""
    t = BOILER.sub(" ", title.lower())
    nums = set(n.replace(",", "").rstrip(".") for n in NUM.findall(t))
    nums = set(n for n in nums if len(n) >= 2)
    words = re.findall(r"[a-z][a-z\-']+", t)
    words = set(w for w in words if len(w) > 2 and w not in STOP)
    return words, nums


def similar(a, b):
    """Same story? Jaccard on words, with a shared-figure shortcut."""
    aw, an = a
    bw, bn = b
    if not aw or not bw:
        return False
    inter = len(aw & bw)
    union = len(aw | bw)
    j = inter / union if union else 0.0
    shared_nums = an & bn
    if shared_nums and j >= 0.28 and inter >= 3:
        return True          # shared figure + decent overlap is a strong signal
    return j >= 0.45


class DSU:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def fetch(feed):
    try:
        req = urllib.request.Request(feed["url"], headers={"User-Agent": "Mozilla/5.0 (news-agent)"})
        with urllib.request.urlopen(req, timeout=25) as r:
            content = r.read()
        out = []
        for it in parse_feed(content, source=feed["name"]):
            it["category"] = feed["category"]
            it["region"] = feed["region"]
            it["publisher"] = feed["publisher"]
            it["kind"] = feed["kind"]
            out.append(it)
        return out, None
    except Exception as exc:
        return [], "%s: %s" % (feed["name"], str(exc)[:70])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=30.0)
    ap.add_argument("--min-cluster", type=int, default=1)
    ap.add_argument("--show", type=int, default=40)
    args = ap.parse_args()

    cfg = json.loads(Path("feeds.json").read_text(encoding="utf-8"))
    feeds = cfg["feeds"]

    rows, errors = [], []
    with ThreadPoolExecutor(max_workers=12) as pool:
        for items, err in pool.map(fetch, feeds):
            rows.extend(items)
            if err:
                errors.append(err)

    now = datetime.datetime.now(datetime.timezone.utc)
    fresh = []
    for i in rows:
        p = i.get("published")
        if not p:
            continue
        try:
            d = datetime.datetime.fromisoformat(p.replace("Z", "+00:00"))
        except Exception:
            continue
        if d.tzinfo is None:
            d = d.replace(tzinfo=datetime.timezone.utc)
        age = (now - d).total_seconds() / 3600.0
        if 0 <= age <= args.hours:
            i["_age"] = age
            fresh.append(i)

    fresh.sort(key=lambda x: x["_age"])
    sigs = [toks(i["title"]) for i in fresh]

    dsu = DSU(len(fresh))
    for a in range(len(fresh)):
        for b in range(a + 1, len(fresh)):
            if fresh[a]["publisher"] == fresh[b]["publisher"]:
                continue          # same publisher repeating itself is not corroboration
            if similar(sigs[a], sigs[b]):
                dsu.union(a, b)

    groups = defaultdict(list)
    for idx in range(len(fresh)):
        groups[dsu.find(idx)].append(fresh[idx])

    clusters = []
    for members in groups.values():
        counting = set(m["publisher"] for m in members if m["kind"] in ("news", "primary"))
        primaries = set(m["publisher"] for m in members if m["kind"] == "primary")
        n = len(counting)
        if primaries:
            tier, rank = "primary", 4
        elif n >= 3:
            tier, rank = "corroborated", 3
        elif n == 2:
            tier, rank = "thin", 2
        else:
            tier, rank = "single", 1
        lead = min(members, key=lambda m: (m["kind"] != "primary", m["_age"]))
        # Category by majority vote, not by whichever feed happened to be fastest. A general-news
        # story carried by ET Markets is not a markets story.
        cat_votes = Counter(m["category"] for m in members)
        top = max(cat_votes.values())
        tied = sorted(c for c, v in cat_votes.items() if v == top)
        category = lead["category"] if lead["category"] in tied else tied[0]
        region = Counter(m["region"] for m in members).most_common(1)[0][0]
        clusters.append({
            "tier": tier,
            "rank": rank,
            "publisher_count": n,
            "publishers": sorted(counting),
            "region": region,
            "category": category,
            "title": lead["title"],
            "url": lead["url"],
            "source": lead["source"],
            "image_url": lead.get("image_url", ""),
            "published": lead.get("published", ""),
            "age_h": round(lead["_age"], 1),
            "members": [{"source": m["source"], "publisher": m["publisher"], "title": m["title"],
                         "url": m["url"], "kind": m["kind"], "image_url": m.get("image_url", ""),
                         "published": m.get("published", ""), "age_h": round(m["_age"], 1)}
                        for m in sorted(members, key=lambda x: x["_age"])],
        })

    clusters = [c for c in clusters if len(c["members"]) >= args.min_cluster]
    clusters.sort(key=lambda c: (-c["rank"], -c["publisher_count"], c["age_h"]))
    json.dump(clusters, io.open("_clusters.json", "w", encoding="utf-8"), ensure_ascii=False)

    badge = {"primary": "PRIMARY", "corroborated": "CONFIRMED", "thin": "THIN", "single": "SINGLE"}
    print("feeds=%d  items=%d  fresh<=%gh=%d  clusters=%d  errors=%d"
          % (len(feeds), len(rows), args.hours, len(fresh), len(clusters), len(errors)))
    for e in errors:
        print("   ERROR " + e)
    print("=" * 118)
    print("%-10s %3s  %-6s %-16s %-58s %s" % ("TIER", "N", "REGION", "CATEGORY", "HEADLINE", "PUBLISHERS"))
    print("-" * 118)
    for c in clusters[:args.show]:
        print("%-10s %3d  %-6s %-16s %-58s %s" % (
            badge[c["tier"]], c["publisher_count"], c["region"].upper(), c["category"][:16],
            c["title"][:58], ", ".join(c["publishers"][:5]) or "-"))

    print("-" * 118)
    print("tiers:", dict(Counter(c["tier"] for c in clusters)))
    print("regions:", dict(Counter(c["region"] for c in clusters)))


if __name__ == "__main__":
    main()
