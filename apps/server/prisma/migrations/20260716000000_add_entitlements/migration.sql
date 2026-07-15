-- Per-agent entitlements: additive only.
--
-- HAND-CURATED. `prisma migrate diff` against the live datasource is UNUSABLE
-- here: the live DB has drifted from schema.prisma, so the generated diff also
-- contained 5 DROP TABLE (community_comment, community_post,
-- conversation_memories, post_analytics, rag_chunks), 1 DROP TYPE, 15 DROP
-- INDEX and 4 DROP FOREIGN KEY -- none of them ours, and destructive.
--
-- This file contains ONLY the additive statements for this feature, copied
-- verbatim from that diff. Every statement below is CREATE or ADD. There is no
-- DROP. Legacy column removal happens in a separate, later migration once the
-- backfill is verified in production.

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('TRIAL', 'AGENT', 'CREW');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "status" "EntitlementStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "billingSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dodoSubscriptionId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Hot path: the per-agent access check.
CREATE INDEX "entitlement_organizationId_agent_currentPeriodEnd_idx" ON "entitlement"("organizationId", "agent", "currentPeriodEnd");

-- CreateIndex
-- Sweeper: find lapsed rows.
CREATE INDEX "entitlement_currentPeriodEnd_status_idx" ON "entitlement"("currentPeriodEnd", "status");

-- CreateIndex
CREATE INDEX "entitlement_billingSubscriptionId_idx" ON "entitlement"("billingSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_dodoSubscriptionId_key" ON "billing_subscription"("dodoSubscriptionId");

-- CreateIndex
CREATE INDEX "billing_subscription_organizationId_idx" ON "billing_subscription"("organizationId");

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_billingSubscriptionId_fkey" FOREIGN KEY ("billingSubscriptionId") REFERENCES "billing_subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
