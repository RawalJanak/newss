from pathlib import Path

from mcp.server.fastmcp import FastMCP

from server import feeds, extractor

ROOT = Path(__file__).parent.parent
mcp = FastMCP("news-fetcher")


@mcp.tool()
def fetch_headlines() -> dict:
    """Fetch all configured RSS feeds; return fresh (previously unseen) headline
    items and any per-feed errors. Does NOT mark URLs seen — call
    confirm_seen after articles.json is written. Items: title, url, source,
    published, summary, feed_category (when configured), wire (bool)."""
    return feeds.fetch_all(ROOT / "feeds.json")


@mcp.tool()
def confirm_seen(urls: list[str]) -> dict:
    """Mark headline URLs as seen after a successful digest write."""
    return feeds.confirm_seen_urls(urls)


@mcp.tool()
def extract_articles(urls: list[str]) -> list[dict]:
    """Extract full article content (title, text, image_url, authors, date) for
    up to 30 URLs. Failed URLs return an 'error' field instead of raising."""
    return extractor.extract_articles(urls)


if __name__ == "__main__":
    mcp.run()
