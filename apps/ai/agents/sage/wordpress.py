"""Utilities for formatting content for WordPress and Wix publishing platforms."""
from datetime import datetime


def format_for_wordpress(
    title: str,
    content: str,
    tags: list[str] | None = None,
    categories: list[str] | None = None,
) -> dict:
    """Format content for WordPress REST API (wp/v2/posts endpoint)."""
    return {
        "title": {"rendered": title},
        "content": {"rendered": content},
        "status": "draft",
        "tags": tags or [],
        "categories": categories or [],
        "meta": {
            "og:title": title,
            "og:description": content[:160] if content else "",
        },
        "format": "standard",
        "date": datetime.utcnow().isoformat(),
        "_wp_api_format": "wp/v2",
    }


def format_for_wix(
    title: str,
    content: str,
    excerpt: str = "",
    tags: list[str] | None = None,
) -> dict:
    """Format content for Wix Blog API."""
    return {
        "title": title,
        "content": {
            "html": content,
        },
        "excerpt": excerpt or content[:200],
        "tags": tags or [],
        "status": "DRAFT",
        "featured": False,
        "seoData": {
            "title": title,
            "description": excerpt or content[:160],
            "tags": [{"type": "OPEN_GRAPH", "name": "og:title", "content": title}],
        },
        "_wix_api_format": "v3/blog/posts",
    }
