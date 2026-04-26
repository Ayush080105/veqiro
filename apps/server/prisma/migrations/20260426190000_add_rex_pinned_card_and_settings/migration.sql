-- CreateTable
CREATE TABLE IF NOT EXISTS "rex_pinned_card" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rex_pinned_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rex_pinned_card_organizationId_position_idx" ON "rex_pinned_card"("organizationId", "position");

-- CreateTable
CREATE TABLE IF NOT EXISTS "rex_settings" (
    "organizationId" TEXT NOT NULL,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigestTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "weeklyDigestRecipients" TEXT[] NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rex_settings_pkey" PRIMARY KEY ("organizationId")
);
