"""
Per-(org, agent) MCP tool-list cache. Avoids re-listing tools from Composio
on every chat turn — see MCP_INTEGRATIONS_FINAL.pdf-derived plan, Risk #6
(RPC/usage exposure).
"""

from __future__ import annotations

import hashlib
import time

from core.tools import ToolDefinition
from core.mcp import client as mcp_client
from core.mcp.naming import sanitize_tool_name, dedupe_alias

_TTL_SECONDS = 30 * 60
# OpenAI hard-rejects requests with >128 total tools (400 array_above_max_length).
# A connection's real catalog can be much larger (seen: 167 for Slack) since
# the important:false fetch in mcp.provider.composio.ts intentionally stopped
# truncating per-toolkit — this caps the merged MCP total instead.
_OPENAI_TOOL_LIMIT = 128
# Buffer for anything added after this merge (e.g. future tools) — small
# because reserved_tools below already accounts for native tools + ask_agent.
_SAFETY_MARGIN = 3
# Was a flat 100 previously. That silently starved agents with several
# richly-featured connections: e.g. Vega with 7 connections had 78 important-
# tagged tools from 6 other integrations fill the cap before Slack (processed
# last) was even considered, dropping SLACK_SEARCH_MESSAGES entirely even
# though it's tagged important. Computing the real per-agent budget (below)
# fixes this generically instead of guessing a fixed number.

# Bound so a long-lived process can't accumulate an entry per (org, agent,
# connection-set, budget) forever. Evicted oldest-expiry-first once exceeded.
_MAX_CACHE_ENTRIES = 500

# key -> (expires_at, tool_defs, alias_map); see _cache_key for what's in it.
_cache: dict[str, tuple[float, list[ToolDefinition], dict[str, tuple[str, str]]]] = {}


def _cache_key(
    organization_id: str,
    agent_slug: str,
    connections: list[dict],
    reserved_tools: int,
) -> str:
    """Identify a cache entry by everything that changes its contents.

    Keying on (org, agent) alone was wrong in both directions:

    * `connections` is filtered before this call — by mcp_tool_preference in
      chat_sync, and per-step by the run executor. A narrowed call would
      populate the entry, and the next unfiltered call would then read that
      starved list back for the rest of the TTL.
    * `reserved_tools` feeds `max_mcp_tools`, so a call with a different native
      tool count computes a different truncation and must not reuse another's.
    """
    conn_sig = ",".join(sorted(str(c.get("connectionId", "")) for c in connections))
    digest = hashlib.sha1(conn_sig.encode("utf-8")).hexdigest()[:12]
    return f"{organization_id}:{agent_slug}:{digest}:{reserved_tools}"


def _evict_if_needed() -> None:
    if len(_cache) <= _MAX_CACHE_ENTRIES:
        return
    now = time.monotonic()
    for key in [k for k, (exp, _, _) in _cache.items() if exp <= now]:
        del _cache[key]
    if len(_cache) <= _MAX_CACHE_ENTRIES:
        return
    for key, _ in sorted(_cache.items(), key=lambda kv: kv[1][0])[
        : len(_cache) - _MAX_CACHE_ENTRIES
    ]:
        del _cache[key]


async def get_mcp_tools(
    organization_id: str, agent_slug: str, connections: list[dict], reserved_tools: int = 0
) -> tuple[list[ToolDefinition], dict[str, tuple[str, str]]]:
    """
    connections: the `mcp_connections` list Node placed in request.metadata,
    e.g. [{"connectionId": "ca_...", "toolkitSlug": "slack", "integrationSlug": "slack"}].

    reserved_tools: how many non-MCP tools (native + ask_agent) this agent's
    call already has, so the MCP budget can use the real remaining headroom
    under OpenAI's tool-count limit instead of one shared flat guess.

    Returns (tool_definitions, alias_map) where alias_map maps the sanitized
    LLM-facing tool name back to (connection_id, real_tool_name) for dispatch.
    """
    if not connections:
        return [], {}

    max_mcp_tools = max(_OPENAI_TOOL_LIMIT - reserved_tools - _SAFETY_MARGIN, 0)
    key = _cache_key(organization_id, agent_slug, connections, reserved_tools)
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
                # Fail closed: if Node ever omits isWrite, treat as a write.
                is_write=t.get("isWrite", True),
                important=t.get("important", False),
            ))
            alias_map[alias] = (connection_id, real_name)

    if len(tool_defs) > max_mcp_tools:
        # Stable sort: important-tagged tools first, ties broken by original
        # (per-connection API) order — so truncation drops the long tail of
        # rarely-used actions rather than an arbitrary/unstable subset.
        tool_defs.sort(key=lambda td: not td.important)
        tool_defs = tool_defs[:max_mcp_tools]
        kept_names = {td.name for td in tool_defs}
        alias_map = {name: target for name, target in alias_map.items() if name in kept_names}

    _cache[key] = (time.monotonic() + _TTL_SECONDS, tool_defs, alias_map)
    _evict_if_needed()
    return tool_defs, alias_map


def invalidate(organization_id: str) -> None:
    """Drop all cached tool lists for this org (every agent) — called when a
    connection is created/removed so the next chat turn re-discovers tools
    instead of waiting out the TTL."""
    stale = [k for k in _cache if k.startswith(f"{organization_id}:")]
    for k in stale:
        del _cache[k]
