-- Discovered trigger types, cached per toolkit (one row serves every org), and
-- a per-subscription instruction override.

CREATE TABLE "mcp_trigger_catalog" (
    "toolkitSlug" TEXT NOT NULL,
    "provider" "McpProvider" NOT NULL DEFAULT 'COMPOSIO',
    "triggers" JSONB NOT NULL,
    "triggerCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_trigger_catalog_pkey" PRIMARY KEY ("toolkitSlug")
);

ALTER TABLE "mcp_trigger_subscription" ADD COLUMN "instruction" TEXT;
