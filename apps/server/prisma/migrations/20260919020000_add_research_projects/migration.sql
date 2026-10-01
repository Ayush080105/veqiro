-- Scout research projects: the durable objects Scout has never had.
--
-- Research is one-off chat today — the answer scrolls past and the sources with it,
-- so the same question gets asked again next month. ResearchProject keeps the
-- question, ResearchSource keeps what was read (with a retrieval date, which is what
-- makes "this was true in March" answerable), and ResearchFinding keeps the
-- conclusions with the evidence they rest on.
--
-- Sources are a table rather than a JSON blob on the project because the PRD's
-- evidence requirement is that a customer can inspect what a claim rests on: a
-- source needs its own identity to be cited from a finding.
--
-- Hand-written like the others here; this database has drift from migration history.
-- Fully additive — nothing reads these yet.

CREATE TYPE "ResearchStatus" AS ENUM ('BRIEF', 'RESEARCHING', 'READY', 'CLOSED', 'ARCHIVED');
CREATE TYPE "FindingConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "research_project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "brief" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'BRIEF',
    "subjectCompany" TEXT,
    "summary" TEXT,
    "monitored" BOOLEAN NOT NULL DEFAULT false,
    "lastResearchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "research_project_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_project_organizationId_status_updatedAt_idx" ON "research_project"("organizationId", "status", "updatedAt");
CREATE INDEX "research_project_organizationId_monitored_idx" ON "research_project"("organizationId", "monitored");
ALTER TABLE "research_project" ADD CONSTRAINT "research_project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "research_source" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "snippet" TEXT NOT NULL DEFAULT '',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "research_source_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "research_source_projectId_url_key" ON "research_source"("projectId", "url");
CREATE INDEX "research_source_organizationId_retrievedAt_idx" ON "research_source"("organizationId", "retrievedAt");
ALTER TABLE "research_source" ADD CONSTRAINT "research_source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "research_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "research_finding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "statement" TEXT NOT NULL,
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "research_finding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_finding_projectId_createdAt_idx" ON "research_finding"("projectId", "createdAt");
CREATE INDEX "research_finding_organizationId_createdAt_idx" ON "research_finding"("organizationId", "createdAt");
ALTER TABLE "research_finding" ADD CONSTRAINT "research_finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "research_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_finding" ADD CONSTRAINT "research_finding_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "research_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
