-- Lex legal memory: contract metadata and a cached review on lex_source, plus findings,
-- obligations (dates and duties), company preferences, an activity trail and settings.
--
-- Hand-written for the same reason as the message-pin migration: this database has
-- pre-existing drift from migration history, so `prisma migrate dev` cannot generate a diff.

ALTER TABLE "lex_source" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "lex_source" ADD COLUMN "counterparty" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "perspective" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "lex_source" ADD COLUMN "expiryDate" TIMESTAMP(3);
ALTER TABLE "lex_source" ADD COLUMN "renewalDate" TIMESTAMP(3);
ALTER TABLE "lex_source" ADD COLUMN "noticeDeadline" TIMESTAMP(3);
ALTER TABLE "lex_source" ADD COLUMN "autoRenewal" BOOLEAN;
ALTER TABLE "lex_source" ADD COLUMN "contractValue" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "currency" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "governingLaw" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "jurisdiction" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "disputeResolution" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "review" JSONB;
ALTER TABLE "lex_source" ADD COLUMN "reviewHeadline" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "reviewAction" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "riskLevel" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "criticalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lex_source" ADD COLUMN "highCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lex_source" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "lex_source" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "lex_source" ADD COLUMN "previousVersionId" TEXT;
ALTER TABLE "lex_source" ADD COLUMN "versionComparison" JSONB;
ALTER TABLE "lex_source" ADD COLUMN "versionComparisonSeen" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "lex_finding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceRowId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL DEFAULT '',
    "explanation" TEXT NOT NULL DEFAULT '',
    "suggestedWording" TEXT NOT NULL DEFAULT '',
    "preference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lex_finding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lex_finding_organizationId_idx" ON "lex_finding"("organizationId");
CREATE INDEX "lex_finding_sourceRowId_idx" ON "lex_finding"("sourceRowId");
ALTER TABLE "lex_finding" ADD CONSTRAINT "lex_finding_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "lex_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lex_obligation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceRowId" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'you',
    "description" TEXT NOT NULL,
    "whenText" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "recurrence" TEXT NOT NULL DEFAULT 'once',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reminderOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lex_obligation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lex_obligation_sourceRowId_description_whenText_key" ON "lex_obligation"("sourceRowId", "description", "whenText");
CREATE INDEX "lex_obligation_organizationId_status_dueDate_idx" ON "lex_obligation"("organizationId", "status", "dueDate");
ALTER TABLE "lex_obligation" ADD CONSTRAINT "lex_obligation_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "lex_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lex_preference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lex_preference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lex_preference_organizationId_key_key" ON "lex_preference"("organizationId", "key");

CREATE TABLE "lex_activity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceRowId" TEXT,
    "actor" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lex_activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lex_activity_organizationId_createdAt_idx" ON "lex_activity"("organizationId", "createdAt");
CREATE INDEX "lex_activity_sourceRowId_createdAt_idx" ON "lex_activity"("sourceRowId", "createdAt");
ALTER TABLE "lex_activity" ADD CONSTRAINT "lex_activity_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "lex_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "lex_settings" (
    "organizationId" TEXT NOT NULL,
    "weeklyBrief" BOOLEAN NOT NULL DEFAULT false,
    "lastBriefAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lex_settings_pkey" PRIMARY KEY ("organizationId")
);
