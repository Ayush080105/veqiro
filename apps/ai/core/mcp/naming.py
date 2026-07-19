"""
Alias MCP tool names into something OpenAI/Gemini function-calling accepts
(roughly ^[a-zA-Z0-9_-]{1,64}$) and keep a map back to the real
(connection_id, real_tool_name) pair needed to actually invoke it.
"""

from __future__ import annotations

import re

_UNSAFE = re.compile(r"[^a-zA-Z0-9_-]")


def sanitize_tool_name(integration_slug: str, real_name: str) -> str:
    slug = _UNSAFE.sub("_", integration_slug)
    name = _UNSAFE.sub("_", real_name)
    return f"mcp_{slug}_{name}"[:64]


def dedupe_alias(alias: str, taken: set[str]) -> str:
    """Truncation to 64 chars can collide — append a short numeric suffix."""
    if alias not in taken:
        return alias
    for i in range(2, 100):
        suffix = f"_{i}"
        candidate = alias[: 64 - len(suffix)] + suffix
        if candidate not in taken:
            return candidate
    # Astronomically unlikely fallback.
    return f"{alias[:56]}_{len(taken)}"
