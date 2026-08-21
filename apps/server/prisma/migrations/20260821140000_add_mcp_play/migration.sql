-- Plays: named repeatable jobs an org switches on. Definitions live in code
-- (mcp.plays.ts); this table holds only the per-org state.

CREATE TABLE "mcp_play" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "playId" TEXT NOT NULL,
    -- Copied from the catalog at enable time, so revising a play's default
    -- schedule doesn't silently move an existing customer's Monday.
    "schedule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mcp_play_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_play_organizationId_playId_key" ON "mcp_play"("organizationId", "playId");
CREATE INDEX "mcp_play_enabled_idx" ON "mcp_play"("enabled");
