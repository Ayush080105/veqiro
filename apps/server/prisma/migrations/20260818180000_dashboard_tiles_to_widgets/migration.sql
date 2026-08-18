-- Replace the field-path/aggregation tile model with widget references.
--
-- The earlier model asked the customer to pick a JSON path and an aggregation,
-- which is a developer tool: a founder cannot tell which of 23 discovered paths
-- is their unread mail, and much of what they want to see is a list of real
-- items, not a number. Widget definitions now own the tool, arguments, field
-- mapping and formatting (see mcp.widgets.ts); the tile just references one.
--
-- Safe to drop rather than migrate: verified zero rows before writing this.
DROP INDEX IF EXISTS "mcp_dashboard_tile_organizationId_integrationSlug_toolName_key";

ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "toolName";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "arguments";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "noun";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "aggregation";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "fieldPath";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "scale";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "decimals";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "prefix";
ALTER TABLE "mcp_dashboard_tile" DROP COLUMN "suffix";

ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "widgetId" TEXT NOT NULL;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "inputs" JSONB;
ALTER TABLE "mcp_dashboard_tile" ADD COLUMN "label" TEXT;
