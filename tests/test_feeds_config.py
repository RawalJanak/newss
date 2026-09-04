import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEEDS = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))["feeds"]

REQUIRED_KEYS = {"name", "category", "region", "publisher", "kind", "url"}


def test_every_feed_has_required_keys():
    for f in FEEDS:
        assert REQUIRED_KEYS <= set(f), f"{f.get('name')} missing {REQUIRED_KEYS - set(f)}"


def test_no_duplicate_feed_urls():
    urls = [f["url"] for f in FEEDS]
    assert len(urls) == len(set(urls)), "duplicate feed URLs"


def test_new_lanes_present():
    cats = {f["category"] for f in FEEDS}
    for lane in ("Sports", "Entertainment", "Science", "Education", "Government", "Exam"):
        assert lane in cats, f"missing lane: {lane}"


def test_feed_kind_is_valid():
    for f in FEEDS:
        assert f["kind"] in {"news", "primary", "newsletter", "aggregator"}, f["name"]


def test_exam_lane_feeds_are_aggregators():
    # Google News query feeds must never count toward corroboration
    for f in FEEDS:
        if f["category"] == "Exam":
            assert f["kind"] == "aggregator", f"{f['name']} must be kind=aggregator"
