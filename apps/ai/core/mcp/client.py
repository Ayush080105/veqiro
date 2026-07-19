"""
apps/ai's only path to Smithery is through Node — Node holds the Smithery
master API key exclusively (see apps/server/src/lib/smithery.ts) and enforces
that a connectionId belongs to the calling organization before ever calling
Smithery. This module just makes plain internal REST calls to Node, mirroring
the pattern already established in core/brand_kit.py.
"""

from __future__ import annotations

import logging

import httpx

from core.config import settings

logger = logging.getLogger("mcp_client")

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15)
    return _http_client


class McpToolCallError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


async def list_connection_tools(organization_id: str, connection_id: str) -> list[dict]:
    """Returns raw Smithery Tool dicts: {name, description?, inputSchema, ...}."""
    url = f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/mcp/connections/{connection_id}/tools"
    client = _get_http_client()
    resp = await client.get(
        url,
        params={"organization_id": organization_id},
        headers={"x-internal-key": settings.INTERNAL_API_KEY},
    )
    if resp.status_code != 200:
        logger.warning(
            "mcp list_tools failed | org=%s connection=%s status=%s",
            organization_id, connection_id, resp.status_code,
        )
        return []
    return resp.json().get("tools", [])


async def call_connection_tool(
    organization_id: str, connection_id: str, tool_name: str, arguments: dict
) -> dict:
    url = f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/mcp/connections/{connection_id}/tools/call"
    client = _get_http_client()
    resp = await client.post(
        url,
        params={"organization_id": organization_id},
        json={"toolName": tool_name, "args": arguments},
        headers={"x-internal-key": settings.INTERNAL_API_KEY},
    )
    if resp.status_code != 200:
        raise McpToolCallError(f"MCP tool call failed ({resp.status_code}): {resp.text[:500]}")
    return resp.json()
