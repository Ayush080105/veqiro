-- SeoPage / SeoIssue: Sage's audits become monitoring.
--
-- Audits were stateless — a score and a list of problems that scrolled away — so there
-- was no way to tell whether last month's work helped or whether a page got worse.
-- Keeping the page keeps the score history, and a score history is what turns an audit
-- into monitoring.
--
-- Issues are rows rather than a JSON array on the page because they have a life of
-- their own: a customer fixes one, ignores another, and expects the next audit to
-- notice. Re-deriving status from audit text every run would lose every decision they
-- made.
--
-- Hand-written; this database has drift from migration history. Fully additive.

CREATE TYPE "SeoIssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'QUICK_WIN');
CREATE TYPE "SeoIssueStatus" AS ENUM ('OPEN', 'FIXED', 'IGNORED');

CREATE TABLE "seo_page" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "targetKeyword" TEXT NOT NULL DEFAULT '',
    "score" INTEGER,
    "previousScore" INTEGER,
    "summary" TEXT NOT NULL DEFAULT '',
    "nextMove" TEXT NOT NULL DEFAULT '',
    "lastAuditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seo_page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_page_organizationId_url_key" ON "seo_page"("organizationId", "url");
CREATE INDEX "seo_page_organizationId_score_idx" ON "seo_page"("organizationId", "score");
CREATE INDEX "seo_page_organizationId_lastAuditedAt_idx" ON "seo_page"("organizationId", "lastAuditedAt");
ALTER TABLE "seo_page" ADD CONSTRAINT "seo_page_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "seo_issue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "severity" "SeoIssueSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SeoIssueStatus" NOT NULL DEFAULT 'OPEN',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "seo_issue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_issue_pageId_description_key" ON "seo_issue"("pageId", "description");
CREATE INDEX "seo_issue_organizationId_status_severity_idx" ON "seo_issue"("organizationId", "status", "severity");
ALTER TABLE "seo_issue" ADD CONSTRAINT "seo_issue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "seo_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
