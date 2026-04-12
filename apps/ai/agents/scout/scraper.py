import hashlib
import difflib
import logging
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
