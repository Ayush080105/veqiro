-- Cross-restart cache for toolkit tool catalogs. One row per toolkit, shared
-- by every org: listTools resolves on toolkit slug alone.

CREATE TABLE "mcp_tool_catalog" (
    "toolkitSlug" TEXT NOT NULL,
    "provider" "McpProvider" NOT NULL DEFAULT 'COMPOSIO',
    "tools" JSONB NOT NULL,
    "toolCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_tool_catalog_pkey" PRIMARY KEY ("toolkitSlug")
);
