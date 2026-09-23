# -*- coding: utf-8 -*-
"""Build app/trending.json: top 10 trending topics across real platform
trending mechanisms -- Google Trends (official RSS), Reddit r/popular
(official hot-ranking), and X/Twitter Trending (via the user's own
authenticated OpenCLI browser session). Never fabricated or approximated
from search/timeline activity -- if a platform has no genuine trending
endpoint available (Instagram's explore/discover call is currently
blocked upstream), it's left out rather than faked.

Run as part of the routine, alongside build_important.py/build_graph.py.
Requires OPENCLI_PROFILE set in the environment for the reddit/twitter
calls; degrades that one source to empty (not a hard failure) if the
CLI call fails, so one platform being down doesn't block the whole run.
"""
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IST = timezone(timedelta(hours=5, minutes=30))
OPENCLI_PROFILE = "4yggmh8b"


def fetch_google_trends(geo="IN", limit=10):
    url = "https://trends.google.com/trending/rss?geo=" + geo
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            xml = r.read()
        root = ET.fromstring(xml)
        ns = {"ht": "https://trends.google.com/trending/rss"}
        items = []
        for item in root.findall(".//item")[:limit]:
            title = item.findtext("title") or ""
            traffic = item.findtext("ht:approx_traffic", default="", namespaces=ns)
            news_item = item.find("ht:news_item", ns)
            link = None
            if news_item is not None:
                link = news_item.findtext("ht:news_item_url", default=None, namespaces=ns)
            if not link:
                link = "https://www.google.com/search?q=" + urllib.parse.quote(title)
            items.append({
                "platform": "Google Trends", "topic": title,
                "meta": (traffic + " searches") if traffic else "",
                "url": link,
            })
        return items
    except Exception as e:
        print("google trends fetch failed:", e)
        return []


def run_opencli(args):
    env = dict(os.environ)
    env["OPENCLI_PROFILE"] = OPENCLI_PROFILE
    try:
        # shell=True so Windows resolves the npm-installed opencli.cmd shim;
        # args are our own fixed literals, never user input, so this is safe.
        cmd = "opencli " + " ".join(args)
        r = subprocess.run(cmd, capture_output=True, timeout=30, env=env, shell=True)
        out = r.stdout.decode("utf-8", errors="replace").strip()
        start = out.find("[")
        if start == -1:
            return []
        return json.loads(out[start:])
    except Exception as e:
        print("opencli", args, "failed:", e)
        return []


def fetch_reddit_popular(limit=10):
    posts = run_opencli(["reddit", "popular", "-f", "json"])
    items = []
    for p in posts[:limit]:
        items.append({
            "platform": "Reddit", "topic": p.get("title", ""),
            "meta": p.get("subreddit", "") + " · " + str(p.get("score", 0)) + " upvotes",
            "url": p.get("url") or ("https://reddit.com" + str(p.get("id", ""))),
        })
    return items


def fetch_twitter_trending(limit=10):
    trends = run_opencli(["twitter", "trending", "-f", "json"])
    items = []
    for t in trends[:limit]:
        topic = t.get("topic", "")
        items.append({
            "platform": "X (Twitter)", "topic": topic,
            "meta": t.get("category", ""),
            "url": "https://x.com/search?q=" + urllib.parse.quote(topic),
        })
    return items


def interleave(*lists):
    out = []
    i = 0
    while len(out) < 10 and any(lists):
        for lst in lists:
            if i < len(lst):
                out.append(lst[i])
        i += 1
        if i > 10:
            break
    return out[:10]


def main():
    google = fetch_google_trends()
    reddit = fetch_reddit_popular()
    twitter = fetch_twitter_trending()

    items = interleave(twitter, reddit, google)
    for idx, it in enumerate(items, 1):
        it["rank"] = idx

    out = {
        "generated_at": datetime.now(IST).isoformat(),
        "items": items,
        "sources": {
            "Google Trends": len(google) > 0,
            "Reddit": len(reddit) > 0,
            "X (Twitter)": len(twitter) > 0,
        },
    }
    (ROOT / "app" / "trending.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("trending.json: %d items (google=%d reddit=%d twitter=%d)" % (
        len(items), len(google), len(reddit), len(twitter)
    ))


if __name__ == "__main__":
    main()
