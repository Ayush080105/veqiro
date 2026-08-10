-- Swap MCP broker from Smithery to Composio. Hand-written per the established
-- convention in this migrations folder (see 20260719000000_add_mcp_connection)
-- — the live datasource has pre-existing drift from migration history, so
-- `prisma migrate diff`/`dev` against it is unusable without risking
-- destructive DROP statements unrelated to this feature.

-- RenameColumn: Smithery's registry qualifiedName -> Composio's toolkit slug
ALTER TABLE "mcp_connection" RENAME COLUMN "qualifiedName" TO "toolkitSlug";

-- DataMigration: existing rows point at Smithery connection ids/credentials
-- that have no Composio equivalent (Smithery held the credentials
-- server-side; they cannot be transferred). Every previously-connected org
-- must reconnect from scratch under Composio.
UPDATE "mcp_connection"
SET "status" = 'DISCONNECTED',
    "lastError" = 'Reconnect required — migrated to Composio',
    "lastCheckedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('CONNECTED', 'AUTH_REQUIRED', 'PENDING');
