from fastapi import APIRouter
from pydantic import BaseModel

from core.mcp import cache as mcp_cache

router = APIRouter(prefix="/ai/mcp", tags=["MCP"])


class InvalidateCacheRequest(BaseModel):
    organization_id: str


@router.post("/invalidate-cache")
async def invalidate_cache(body: InvalidateCacheRequest):
    """Called by apps/server's mcp.service.ts after a connect/disconnect so
    the next chat turn re-discovers tools instead of waiting out the TTL."""
    mcp_cache.invalidate(body.organization_id)
    return {"ok": True}
