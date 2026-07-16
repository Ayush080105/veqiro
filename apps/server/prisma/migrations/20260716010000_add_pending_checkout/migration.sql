-- PendingCheckout: a checkout awaiting provider confirmation.
-- Replaces the six pending* columns on Subscription (which drop later, once
-- the new flow is verified in production). Holds a SINGLE agent: Dodo returns
-- "422 Only one subscription product allowed per checkout", so one checkout
-- can only ever create one subscription.
--
-- HAND-CURATED, same as 20260716000000_add_entitlements. `prisma migrate diff`
-- against the live datasource remains UNUSABLE: the DB has drifted from
-- schema.prisma, so the generated diff also contains 5 DROP TABLE
-- (community_comment, community_post, conversation_memories, post_analytics,
-- rag_chunks), 1 DROP TYPE, 15 DROP INDEX and 4 DROP FOREIGN KEY -- none ours,
-- all destructive.
--
-- Every statement below is CREATE or ADD. There is no DROP.

-- CreateEnum
CREATE TYPE "CheckoutKind" AS ENUM ('AGENT', 'CREW', 'CREW_UPGRADE');

-- CreateTable
CREATE TABLE "pending_checkout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "CheckoutKind" NOT NULL,
    "agent" "Agent",
    "plan" "SubscriptionPlan" NOT NULL,
    "discountCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_checkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_checkout_sessionId_key" ON "pending_checkout"("sessionId");

-- CreateIndex
CREATE INDEX "pending_checkout_organizationId_createdAt_idx" ON "pending_checkout"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "pending_checkout" ADD CONSTRAINT "pending_checkout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
