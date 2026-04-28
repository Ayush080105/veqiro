-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "BriefingType" AS ENUM ('MORNING', 'EVENING', 'WEEKLY');

-- CreateTable
CREATE TABLE "vega_follow_up" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "draftText" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vega_follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_contact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vega_briefing_cache" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" "BriefingType" NOT NULL,
    "content" JSONB NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vega_briefing_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vega_follow_up_organizationId_status_idx" ON "vega_follow_up"("organizationId", "status");

-- CreateIndex
CREATE INDEX "vega_follow_up_dueAt_idx" ON "vega_follow_up"("dueAt");

-- CreateIndex
CREATE INDEX "vip_contact_organizationId_idx" ON "vip_contact"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "vip_contact_email_organizationId_key" ON "vip_contact"("email", "organizationId");

-- CreateIndex
CREATE INDEX "vega_briefing_cache_organizationId_date_idx" ON "vega_briefing_cache"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "vega_briefing_cache_date_type_organizationId_key" ON "vega_briefing_cache"("date", "type", "organizationId");
