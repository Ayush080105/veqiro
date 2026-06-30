-- Add pending checkout intent fields. Active entitlements are only changed by provider webhooks.
ALTER TABLE "subscription"
ADD COLUMN "pendingCheckoutSessionId" TEXT,
ADD COLUMN "pendingPlan" "SubscriptionPlan",
ADD COLUMN "pendingEntitlementMode" "SubscriptionEntitlementMode",
ADD COLUMN "pendingSelectedAgents" "Agent"[] NOT NULL DEFAULT ARRAY[]::"Agent"[],
ADD COLUMN "pendingProductId" TEXT,
ADD COLUMN "pendingCheckoutCreatedAt" TIMESTAMP(3);

-- Dodo webhook event ledger for idempotent webhook processing.
CREATE TABLE "billing_webhook_event" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "organizationId" TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "result" TEXT NOT NULL,

  CONSTRAINT "billing_webhook_event_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "billing_webhook_event_organizationId_processedAt_idx"
ON "billing_webhook_event"("organizationId", "processedAt");

CREATE INDEX "billing_webhook_event_subscriptionId_idx"
ON "billing_webhook_event"("subscriptionId");
