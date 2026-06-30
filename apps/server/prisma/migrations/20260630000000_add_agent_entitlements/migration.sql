-- CreateEnum
CREATE TYPE "SubscriptionEntitlementMode" AS ENUM ('CREW', 'CUSTOM');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "unlockedAgents" "Agent"[] NOT NULL DEFAULT ARRAY[]::"Agent"[];

-- AlterTable
ALTER TABLE "subscription" ADD COLUMN "entitlementMode" "SubscriptionEntitlementMode" NOT NULL DEFAULT 'CREW',
ADD COLUMN "selectedAgents" "Agent"[] NOT NULL DEFAULT ARRAY[]::"Agent"[];

-- Backfill existing paid/trial subscriptions as full Crew access.
UPDATE "subscription"
SET "entitlementMode" = 'CREW',
    "selectedAgents" = ARRAY['MAYA', 'SAGE', 'LEX', 'REX', 'SCOUT', 'VEGA']::"Agent"[]
WHERE "selectedAgents" = ARRAY[]::"Agent"[];

UPDATE "organization" o
SET "unlockedAgents" = ARRAY['MAYA', 'SAGE', 'LEX', 'REX', 'SCOUT', 'VEGA']::"Agent"[]
FROM "subscription" s
WHERE s."organizationId" = o."id"
  AND o."subscriptionStatus" IN ('TRIALING', 'ACTIVE', 'CANCELLED');
