-- Campaign: the durable object around Maya's campaign generation.
--
-- Until now a campaign run left nothing behind but the images in a chat thread and,
-- if the customer published, a PublishedPost. This records the brief, the assets and
-- what happened to them, so a campaign can be reopened, approved, scheduled and
-- measured. The generation pipeline itself (apps/ai/core/campaign_director.py) is
-- untouched — this wraps it, per the PRD's engineering rule.
--
-- Hand-written like the other migrations here: this database has drift from
-- migration history, so `prisma migrate dev` cannot generate a diff.
--
-- Additive. PublishedPost.campaignId is nullable and every existing row keeps
-- NULL, which is correct: those posts did not come from a campaign.

CREATE TYPE "CampaignStatus" AS ENUM ('BRIEF', 'GENERATING', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "status" "CampaignStatus" NOT NULL DEFAULT 'BRIEF',
    "productImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assets" JSONB,
    "caption" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaign_organizationId_status_updatedAt_idx" ON "campaign"("organizationId", "status", "updatedAt");
CREATE INDEX "campaign_organizationId_createdAt_idx" ON "campaign"("organizationId", "createdAt");
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "published_post" ADD COLUMN "campaignId" TEXT;
CREATE INDEX "published_post_campaignId_idx" ON "published_post"("campaignId");
ALTER TABLE "published_post" ADD CONSTRAINT "published_post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
