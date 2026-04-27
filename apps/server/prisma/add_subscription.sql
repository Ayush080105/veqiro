DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'ACTIVE', 'PAST_DUE', 'CANCELED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "subscription" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId"      TEXT NOT NULL,
  "status"              "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
  "subscriptionId"      TEXT,
  "productId"           TEXT,
  "nextBillingDate"     TIMESTAMP(3),
  "previousBillingDate" TIMESTAMP(3),
  "canceledAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_organizationId_key" ON "subscription"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_subscriptionId_key" ON "subscription"("subscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_organizationId_idx" ON "subscription"("organizationId");
