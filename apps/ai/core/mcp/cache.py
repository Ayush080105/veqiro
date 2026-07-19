"""
Per-(org, agent) MCP tool-list cache. Smithery bills per RPC (tools/list,
tools/call), so this avoids re-listing tools on every chat turn — see
MCP_INTEGRATIONS_FINAL.pdf-derived plan, Risk #6 (RPC billing exposure).
"""

from __future__ import annotations

import time

from core.tools import ToolDefinition
from core.mcp import client as mcp_client
from core.mcp.naming import sanitize_tool_name, dedupe_alias

_TTL_SECONDS = 30 * 60

# key "{organization_id}:{agent_slug}" -> (expires_at, tool_defs, alias_map)
_cache: dict[str, tuple[float, list[ToolDefinition], dict[str, tuple[str, str]]]] = {}


def _cache_key(organization_id: str, agent_slug: str) -> str:
    return f"{organization_id}:{agent_slug}"


async def get_mcp_tools(
    organization_id: str, agent_slug: str, connections: list[dict]
) -> tuple[list[ToolDefinition], dict[str, tuple[str, str]]]:
    """
    connections: the `mcp_connections` list Node placed in request.metadata,
    e.g. [{"connectionId": "mc_...", "qualifiedName": "...", "integrationSlug": "slack"}].

    Returns (tool_definitions, alias_map) where alias_map maps the sanitized
    LLM-facing tool name back to (connection_id, real_tool_name) for dispatch.
    """
    if not connections:
        return [], {}

    key = _cache_key(organization_id, agent_slug)
    cached = _cache.get(key)
    if cached and time.monotonic() < cached[0]:
        return cached[1], cached[2]

    tool_defs: list[ToolDefinition] = []
    alias_map: dict[str, tuple[str, str]] = {}
    taken: set[str] = set()

    for conn in connections:
        connection_id = conn.get("connectionId")
        integration_slug = conn.get("integrationSlug", "mcp")
        if not connection_id:
            continue
        raw_tools = await mcp_client.list_connection_tools(organization_id, connection_id)
        for t in raw_tools:
            real_name = t.get("name")
            if not real_name:
                continue
            alias = dedupe_alias(sanitize_tool_name(integration_slug, real_name), taken)
            taken.add(alias)
            tool_defs.append(ToolDefinition(
                name=alias,
                description=t.get("description") or f"{integration_slug} tool",
                raw_schema=t.get("inputSchema") or {"type": "object", "properties": {}},
            ))
            alias_map[alias] = (connection_id, real_name)

    _cache[key] = (time.monotonic() + _TTL_SECONDS, tool_defs, alias_map)
    return tool_defs, alias_map


def invalidate(organization_id: str) -> None:
    """Drop all cached tool lists for this org (every agent) — called when a
    connection is created/removed so the next chat turn re-discovers tools
    instead of waiting out the TTL."""
    stale = [k for k in _cache if k.startswith(f"{organization_id}:")]
    for k in stale:
        del _cache[k]
