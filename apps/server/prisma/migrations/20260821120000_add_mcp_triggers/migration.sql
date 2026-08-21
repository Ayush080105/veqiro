-- Inbound Composio triggers: subscriptions, an idempotency ledger for
-- delivered events, and a marker on staged actions saying whether a human was
-- present when the action was proposed.

CREATE TYPE "McpActionSource" AS ENUM ('CHAT', 'TRIGGER');
CREATE TYPE "McpTriggerEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'FAILED');

ALTER TABLE "mcp_pending_action"
  ADD COLUMN "source" "McpActionSource" NOT NULL DEFAULT 'CHAT',
  ADD COLUMN "triggerEventId" TEXT;

CREATE TABLE "mcp_trigger_subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationSlug" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "triggerSlug" TEXT NOT NULL,
    "composioTriggerId" TEXT,
    "agent" "Agent" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mcp_trigger_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_trigger_subscription_composioTriggerId_key"
  ON "mcp_trigger_subscription"("composioTriggerId");
CREATE UNIQUE INDEX "mcp_trigger_subscription_organizationId_triggerSlug_key"
  ON "mcp_trigger_subscription"("organizationId", "triggerSlug");
CREATE INDEX "mcp_trigger_subscription_organizationId_enabled_idx"
  ON "mcp_trigger_subscription"("organizationId", "enabled");

CREATE TABLE "mcp_trigger_event" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "triggerSlug" TEXT NOT NULL,
    "status" "McpTriggerEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "mcp_trigger_event_pkey" PRIMARY KEY ("id")
);

-- The dedupe key. A duplicate delivery collides here instead of running twice.
CREATE UNIQUE INDEX "mcp_trigger_event_providerEventId_key"
  ON "mcp_trigger_event"("providerEventId");
CREATE INDEX "mcp_trigger_event_organizationId_createdAt_idx"
  ON "mcp_trigger_event"("organizationId", "createdAt");
CREATE INDEX "mcp_trigger_event_subscriptionId_createdAt_idx"
  ON "mcp_trigger_event"("subscriptionId", "createdAt");
