from server.extractor import extract_from_html

HTML = """
<html><head><title>Nifty hits record</title>
<meta property="og:image" content="https://example.com/img.jpg"></head>
<body><article><h1>Nifty hits record</h1>
<p>Indian equity benchmarks closed at record highs on Wednesday, led by IT and
banking stocks. The Nifty 50 rose 1.2 percent while the Sensex added 900 points.</p>
<p>Analysts said foreign inflows and a stable rupee supported the rally.</p>
</article></body></html>
"""

def test_extract_from_html_returns_text_and_image():
    result = extract_from_html(HTML, url="https://example.com/nifty")
    assert result["url"] == "https://example.com/nifty"
    assert "record highs" in result["text"]
    assert result["error"] is None

def test_extract_from_html_handles_garbage():
    result = extract_from_html("<html></html>", url="https://example.com/empty")
    assert result["error"] is not None or result["text"] == ""
