-- Instagram reverted to a native Meta Graph API provider — it no longer uses an
-- MCP connection, and it was the only row that ever used the SMITHERY provider.
-- Delete any Smithery-brokered connection rows, then drop the enum value.
-- Postgres can't DROP a value from an enum in place, so recreate the type.

DELETE FROM "mcp_connection" WHERE "provider" = 'SMITHERY';

-- Recreate McpProvider without SMITHERY
ALTER TYPE "McpProvider" RENAME TO "McpProvider_old";
CREATE TYPE "McpProvider" AS ENUM ('COMPOSIO');
ALTER TABLE "mcp_connection"
  ALTER COLUMN "provider" DROP DEFAULT,
  ALTER COLUMN "provider" TYPE "McpProvider" USING ("provider"::text::"McpProvider"),
  ALTER COLUMN "provider" SET DEFAULT 'COMPOSIO';
DROP TYPE "McpProvider_old";
