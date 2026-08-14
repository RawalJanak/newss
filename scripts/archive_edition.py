#!/usr/bin/env python3
"""Archive the current articles.json before overwriting with a new edition."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "app" / "articles.json"
ARCHIVE = ROOT / "archive"


def archive(path: Path = ARTICLES) -> Path | None:
    if not path.exists():
        return None

    data = json.loads(path.read_text(encoding="utf-8"))
    ts = data.get("generated_at", "").replace(":", "-").replace("+", "_")
    edition = data.get("edition", "unknown")
    if not ts:
        from datetime import datetime, timezone, timedelta

        ist = timezone(timedelta(hours=5, minutes=30))
        ts = datetime.now(ist).strftime("%Y-%m-%dT%H-%M-%S_%z")

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    dest = ARCHIVE / f"{ts.split('T')[0]}-{edition}.json"
    if dest.exists():
        dest = ARCHIVE / f"{ts}-{edition}.json"

    shutil.copy2(path, dest)
    return dest


def main() -> int:
    dest = archive()
    if dest is None:
        print("No articles.json to archive", file=sys.stderr)
        return 1
    print(dest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
