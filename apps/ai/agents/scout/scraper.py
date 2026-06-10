import hashlib
import difflib
import logging
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin
from core.config import settings

logger = logging.getLogger(__name__)


async def scrape_url(url: str) -> str:
    """Scrape and extract main text content from a URL."""
    if settings.MOCK_MODE:
        return (
            f"Mock scraped content from {url}.\n\n"
            "This company offers an AI-powered project management platform targeting SMBs. "
            "Key features: automated task assignment, smart scheduling, real-time analytics dashboard, "
            "and native integrations with Slack, GitHub, and Google Workspace. "
            "Pricing: Starter $15/user/month, Pro $35/user/month, Enterprise custom. "
            "Recent updates: launched AI copilot feature in Q1 2025, raised $12M Series A in Feb 2025. "
            "Team size: 45 employees. Founded: 2022. HQ: San Francisco, CA."
        )
    try:
        import trafilatura
        import asyncio

        def _fetch():
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                return trafilatura.extract(downloaded) or ""
            return ""

        text = await asyncio.to_thread(_fetch)
        return text or f"[No content extracted from {url}]"
    except ImportError:
        import httpx
        import asyncio
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, follow_redirects=True)
            return resp.text[:5000]


def hash_content(content: str) -> str:
    """Return MD5 hash of content string."""
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def diff_content(old: str, new: str) -> str:
    """Return a unified diff summary between two content strings."""
    if old == new:
        return "No changes detected."

    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile="previous", tofile="current", n=3))

    if not diff:
        return "No significant text changes."

    added = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
    summary = f"+{added} lines added, -{removed} lines removed.\n"
    summary += "".join(diff[:50])  # First 50 diff lines
    return summary


async def fetch_rss(url: str, count: int = 10) -> list[dict]:
    """Fetch and parse an RSS feed. In mock mode returns sample news items."""
    if settings.MOCK_MODE:
        return [
            {
                "title": "AI Productivity Tools Market Expected to Hit $23B by 2026",
                "link": "https://example.com/news/ai-productivity-2026",
                "published": "2025-03-15",
                "summary": "New research shows AI-powered productivity platforms are growing at 31% CAGR, driven by SMB adoption.",
                "source": "TechCrunch",
            },
            {
                "title": "Notion Raises $50M to Expand AI Features",
                "link": "https://example.com/news/notion-funding",
                "published": "2025-03-10",
                "summary": "Notion secures additional funding to build out its AI assistant capabilities for enterprise clients.",
                "source": "Crunchbase",
            },
            {
                "title": "Founders Report 40% Time Savings with AI Automation Tools",
                "link": "https://example.com/news/founder-ai-survey",
                "published": "2025-03-08",
                "summary": "Survey of 500 early-stage founders shows significant productivity gains from AI workflow automation.",
                "source": "Forbes",
            },
        ][:count]

    try:
        import feedparser
        import asyncio

        def _parse():
            feed = feedparser.parse(url)
            items = []
            for entry in feed.entries[:count]:
                items.append({
                    "title": getattr(entry, "title", ""),
                    "link": getattr(entry, "link", ""),
                    "published": getattr(entry, "published", ""),
                    "summary": getattr(entry, "summary", "")[:500],
                    "source": feed.feed.get("title", url),
                })
            return items

        return await asyncio.to_thread(_parse)
    except Exception as e:
        return [{"title": f"RSS fetch error: {e}", "link": url, "published": "", "summary": "", "source": ""}]


async def serper_search(query: str, search_type: str = "search") -> list[dict]:
    """
    Search the web via Serper.dev API.
    Returns a list of results with title, link, snippet.
    search_type: "search" (organic Google results) or "news"
    Falls back to empty list if SERPER_API_KEY is not configured.
    """
    if settings.MOCK_MODE:
        return [
            {
                "title": f"Top strategies for {query} in 2025",
                "link": "https://example.com/result-1",
                "snippet": f"Comprehensive guide covering the latest trends and best practices for {query}.",
            },
            {
                "title": f"{query}: Market analysis and competitor landscape",
                "link": "https://example.com/result-2",
                "snippet": f"In-depth analysis of key players, pricing, and opportunities in the {query} space.",
            },
            {
                "title": f"How leading companies approach {query}",
                "link": "https://example.com/result-3",
                "snippet": f"Case studies and expert insights on {query} from industry leaders.",
            },
        ]
    if not settings.SERPER_API_KEY:
        logger.warning("SERPER_API_KEY not set — web search unavailable")
        return []
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://google.serper.dev/{search_type}",
                json={"q": query, "num": 10},
                headers={
                    "X-API-KEY": settings.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in data.get("organic", data.get("news", [])):
            results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            })
        logger.info("Serper search '%s' returned %d results", query, len(results))
        return results
    except Exception as e:
        logger.error("Serper search failed for '%s': %s", query, e)
        return []


def _detect_serp_features(data: dict) -> list[str]:
    """Return SERP feature names present in a raw Serper API response."""
    features = []
    if data.get("answerBox"):
        features.append("featured_snippet")
    if data.get("peopleAlsoAsk"):
        features.append("people_also_ask")
    if data.get("knowledgeGraph"):
        features.append("knowledge_graph")
    if data.get("images"):
        features.append("image_pack")
    if data.get("videos"):
        features.append("video_carousel")
    if data.get("topStories") or data.get("news"):
        features.append("news_pack")
    if data.get("shopping"):
        features.append("shopping_results")
    return features


async def serper_search_rich(query: str) -> dict:
    """Full Serper search returning organic results plus all SERP features.

    Returns a dict with keys: organic, featured_snippet, paa, related_searches,
    knowledge_graph, serp_features. Use this instead of serper_search() when you
    need PAA questions, featured snippet content, or SERP feature detection.
    """
    if settings.MOCK_MODE:
        return {
            "organic": [
                {"title": f"Top guide for {query}", "link": "https://example.com/1", "snippet": f"Everything about {query}."},
                {"title": f"{query}: Complete overview", "link": "https://example.com/2", "snippet": f"Best practices and examples for {query}."},
            ],
            "featured_snippet": None,
            "paa": [f"What is {query}?", f"How does {query} work?", f"Why does {query} matter?"],
            "related_searches": [f"{query} examples", f"best {query}", f"{query} guide 2025"],
            "knowledge_graph": None,
            "serp_features": ["people_also_ask"],
        }
    if not settings.SERPER_API_KEY:
        logger.warning("SERPER_API_KEY not set — rich web search unavailable")
        return {"organic": [], "featured_snippet": None, "paa": [], "related_searches": [], "knowledge_graph": None, "serp_features": []}
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://google.serper.dev/search",
                json={"q": query, "num": 10},
                headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
        organic = [
            {"title": item.get("title", ""), "link": item.get("link", ""), "snippet": item.get("snippet", "")}
            for item in data.get("organic", [])
        ]
        paa = [q["question"] for q in data.get("peopleAlsoAsk", []) if q.get("question")]
        related = [r["query"] for r in data.get("relatedSearches", []) if r.get("query")]
        features = _detect_serp_features(data)
        logger.info("Serper rich search '%s': %d results, features=%s", query, len(organic), features)
        return {
            "organic": organic,
            "featured_snippet": data.get("answerBox") or None,
            "paa": paa,
            "related_searches": related,
            "knowledge_graph": data.get("knowledgeGraph") or None,
            "serp_features": features,
        }
    except Exception as e:
        logger.error("Serper rich search failed for '%s': %s", query, e)
        return {"organic": [], "featured_snippet": None, "paa": [], "related_searches": [], "knowledge_graph": None, "serp_features": []}


async def fetch_page_html(url: str) -> tuple[str, str]:
    """Fetch a URL and return (raw_html, extracted_text). Falls back to ('', text) on extraction failure."""
    if settings.MOCK_MODE:
        mock_html = f"""<html><head><title>Mock Page: {url}</title>
<meta name="description" content="Mock meta description for testing SEO audit features.">
<link rel="canonical" href="{url}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.example.com/analytics.js"></script>
<link rel="stylesheet" href="https://cdn.example.com/styles.css">
</head><body>
<h1>Mock Page Title with Keyword</h1>
<p>This is a mock page for SEO audit testing. It contains relevant content about the topic.</p>
<h2>Key Features</h2><p>Feature overview paragraph with more detail about the subject matter.</p>
<h2>How It Works</h2><p>Step by step explanation of the process.</p>
<img src="hero.jpg" alt="Hero image showing product"><img src="screenshot.png">
<a href="/about">About Us</a> <a href="/contact">Contact</a> <a href="https://external.com">External link</a>
<footer><a href="/privacy">Privacy Policy</a></footer>
</body></html>"""
        mock_text = "Mock Page Title with Keyword\nThis is a mock page for SEO audit testing. Key Features How It Works"
        return mock_html, mock_text

    import httpx
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)"})
            html = resp.text
        try:
            import trafilatura
            import asyncio
            def _extract():
                return trafilatura.extract(html) or ""
            text = await asyncio.to_thread(_extract)
        except ImportError:
            from bs4 import BeautifulSoup
            text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)[:8000]
        return html, text
    except Exception as e:
        logger.error("fetch_page_html failed for '%s': %s", url, e)
        return "", ""


async def fetch_page_status(url: str) -> tuple[int, str | None]:
    """HEAD request to check HTTP status code and final URL after redirects. Fast — no body download."""
    if settings.MOCK_MODE:
        return 200, url
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.head(url, headers={"User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)"})
            return resp.status_code, str(resp.url)
    except Exception as e:
        logger.warning("fetch_page_status failed for '%s': %s", url, e)
        return 0, None


async def fetch_sitemap(domain: str) -> list[str]:
    """Discover all page URLs from a domain's sitemap.xml or sitemap_index.xml.
    Falls back to crawling homepage <a href> links if no sitemap found."""
    if settings.MOCK_MODE:
        base = domain.rstrip("/")
        if not base.startswith("http"):
            base = f"https://{base}"
        return [base + p for p in ["/", "/about", "/blog", "/pricing", "/contact",
                                    "/blog/seo-guide", "/blog/content-strategy", "/features", "/privacy"]]
    if not domain.startswith("http"):
        domain = f"https://{domain}"
    domain = domain.rstrip("/")

    _SM_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"

    def _parse_sitemap_xml(text: str) -> tuple[list[str], list[str]]:
        """Returns (page_urls, sub_sitemap_urls)."""
        pages, subs = [], []
        try:
            root = ET.fromstring(text)
            tag = root.tag.lower()
            if "sitemapindex" in tag:
                for loc in root.findall(f"{{{_SM_NS}}}sitemap/{{{_SM_NS}}}loc"):
                    if loc.text:
                        subs.append(loc.text.strip())
            else:
                for loc in root.findall(f"{{{_SM_NS}}}url/{{{_SM_NS}}}loc"):
                    if loc.text:
                        pages.append(loc.text.strip())
        except ET.ParseError:
            pass
        return pages, subs

    import httpx
    urls: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            for path in ["/sitemap_index.xml", "/sitemap.xml", "/sitemap"]:
                try:
                    resp = await client.get(domain + path)
                    if resp.status_code == 200 and ("xml" in resp.headers.get("content-type", "") or "<url" in resp.text or "<sitemap" in resp.text):
                        pages, subs = _parse_sitemap_xml(resp.text)
                        urls.extend(pages)
                        for sub_url in subs[:5]:
                            try:
                                sub_resp = await client.get(sub_url)
                                if sub_resp.status_code == 200:
                                    sub_pages, _ = _parse_sitemap_xml(sub_resp.text)
                                    urls.extend(sub_pages)
                            except Exception:
                                pass
                        if urls:
                            break
                except Exception:
                    continue

            if not urls:
                from bs4 import BeautifulSoup
                resp = await client.get(domain + "/")
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    parsed_base = urlparse(domain)
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        full = urljoin(domain, href)
                        parsed = urlparse(full)
                        if parsed.netloc == parsed_base.netloc and parsed.scheme in ("http", "https"):
                            urls.append(full)
    except Exception as e:
        logger.error("fetch_sitemap failed for '%s': %s", domain, e)

    seen = set()
    deduped = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped


async def fetch_robots_txt(domain: str) -> dict:
    """Fetch and parse robots.txt. Returns disallowed paths, sitemap directive, crawl delay."""
    if settings.MOCK_MODE:
        return {"found": True, "disallowed_paths": ["/admin", "/private"],
                "has_sitemap_directive": True, "crawl_delay": None, "issues": []}
    if not domain.startswith("http"):
        domain = f"https://{domain}"
    domain = domain.rstrip("/")
    import httpx
    result = {"found": False, "disallowed_paths": [], "has_sitemap_directive": False, "crawl_delay": None, "issues": []}
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(f"{domain}/robots.txt")
            if resp.status_code != 200:
                result["issues"].append("robots.txt not found (404)")
                return result
            result["found"] = True
            for line in resp.text.splitlines():
                line = line.strip()
                if line.lower().startswith("disallow:"):
                    path = line.split(":", 1)[1].strip()
                    if path:
                        result["disallowed_paths"].append(path)
                elif line.lower().startswith("sitemap:"):
                    result["has_sitemap_directive"] = True
                elif line.lower().startswith("crawl-delay:"):
                    try:
                        result["crawl_delay"] = float(line.split(":", 1)[1].strip())
                    except ValueError:
                        pass
            if not result["has_sitemap_directive"]:
                result["issues"].append("No Sitemap directive in robots.txt")
    except Exception as e:
        result["issues"].append(f"robots.txt fetch error: {e}")
    return result


async def google_autocomplete(keyword: str) -> list[str]:
    """Fetch Google autocomplete suggestions. In mock mode returns related keywords."""
    if settings.MOCK_MODE:
        base = keyword.lower()
        return [
            f"{base} for startups",
            f"{base} tools 2025",
            f"best {base} software",
            f"{base} vs alternatives",
            f"how to use {base}",
            f"{base} pricing comparison",
            f"{base} case studies",
            f"free {base} tools",
        ]

    try:
        import httpx
        url = "https://suggestqueries.google.com/complete/search"
        params = {"client": "firefox", "q": keyword}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
            return data[1] if len(data) > 1 else []
    except Exception:
        return [f"{keyword} tools", f"{keyword} tips", f"best {keyword}"]
