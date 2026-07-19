-- MCP integrations via Smithery: org-level pointer to a Smithery-brokered
-- MCP connection. Additive only, hand-written per the established convention
-- in this migrations folder (see 20260716000000_add_entitlements) — the live
-- datasource has pre-existing drift from migration history, so
-- `prisma migrate diff`/`dev` against it is unusable without risking
-- destructive DROP statements unrelated to this feature.

-- CreateEnum
CREATE TYPE "McpConnectionStatus" AS ENUM ('PENDING', 'AUTH_REQUIRED', 'CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "mcp_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationSlug" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "ownerAgent" "Agent" NOT NULL,
    "status" "McpConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "configSchema" JSONB,
    "lastConnectedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_connection_connectionId_key" ON "mcp_connection"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_connection_organizationId_integrationSlug_key" ON "mcp_connection"("organizationId", "integrationSlug");

-- CreateIndex
CREATE INDEX "mcp_connection_organizationId_status_idx" ON "mcp_connection"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "mcp_connection" ADD CONSTRAINT "mcp_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
