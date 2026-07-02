try:
    from newsplease import NewsPlease
    BACKEND = "newsplease"
except ImportError:
    BACKEND = "trafilatura"

import trafilatura


def _empty(url: str, error: str | None = None) -> dict:
    return {"url": url, "title": "", "text": "", "image_url": "",
            "authors": [], "date": "", "error": error}


def extract_from_html(html: str, url: str) -> dict:
    """Extract article fields from raw HTML. Never raises."""
    try:
        if BACKEND == "newsplease":
            a = NewsPlease.from_html(html, url=url)
            result = _empty(url)
            result.update({
                "title": a.title or "",
                "text": a.maintext or "",
                "image_url": a.image_url or "",
                "authors": a.authors or [],
                "date": a.date_publish.isoformat() if a.date_publish else "",
            })
        else:
            meta = trafilatura.extract_metadata(html)
            text = trafilatura.extract(html, url=url) or ""
            result = _empty(url)
            result.update({
                "title": (meta.title if meta else "") or "",
                "text": text,
                "image_url": (meta.image if meta else "") or "",
                "authors": [meta.author] if meta and meta.author else [],
                "date": (meta.date if meta else "") or "",
            })
        if not result["text"]:
            result["error"] = "no text extracted"
        return result
    except Exception as exc:
        return _empty(url, error=str(exc))


def extract_articles(urls: list[str]) -> list[dict]:
    """Fetch and extract each URL. Per-URL failure isolation."""
    import urllib.request

    results = []
    for url in urls[:30]:
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (news-agent)"}
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            results.append(extract_from_html(html, url))
        except Exception as exc:
            results.append(_empty(url, error=str(exc)))
    return results
