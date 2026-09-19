-- Agent workspace framework: the shared primitives every agent workspace needs —
-- an activity feed, a flat index over the typed work tables, proactive insights and
-- cross-agent handoffs — plus the additive widenings that let the existing MCP
-- approval machinery cover native (non-MCP) actions too.
--
-- Hand-written for the same reason as the lex-legal-memory and message-pin migrations:
-- this database has pre-existing drift from migration history, so `prisma migrate dev`
-- cannot generate a diff. Applied by `prisma migrate deploy` on container start.
--
-- Everything here is additive and inert on its own: no existing writer changes
-- behaviour, and with Organization."workspaceUiEnabled" false (the default) no
-- customer sees anything different.

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "ActorKind" AS ENUM ('USER', 'AGENT', 'SYSTEM');
CREATE TYPE "WorkObjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'NEEDS_REVIEW', 'BLOCKED', 'DONE', 'ARCHIVED');
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "InsightStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ACTED', 'DISMISSED', 'EXPIRED');
CREATE TYPE "HandoffStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ApprovalKind" AS ENUM ('MCP_TOOL', 'AGENT_ACTION', 'WORK_OBJECT_MUTATION', 'PUBLISH', 'OUTBOUND_MESSAGE');

-- Two new sources for staged actions. A play-scheduled write was previously
-- indistinguishable from a provider-trigger one.
ALTER TYPE "McpActionSource" ADD VALUE IF NOT EXISTS 'PLAY';
ALTER TYPE "McpActionSource" ADD VALUE IF NOT EXISTS 'HANDOFF';

-- ─── Feature flag ────────────────────────────────────────────────────────────

ALTER TABLE "organization" ADD COLUMN "workspaceUiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ─── Generalise the approval queue beyond MCP tool calls ─────────────────────
-- kind defaults to MCP_TOOL so every existing row keeps its exact meaning, and
-- connectionId only becomes nullable at the database level: it stays required for
-- kind = MCP_TOOL, asserted by the Zod schema and approvals.service.

ALTER TABLE "mcp_pending_action" ADD COLUMN "kind" "ApprovalKind" NOT NULL DEFAULT 'MCP_TOOL';
ALTER TABLE "mcp_pending_action" ADD COLUMN "actionId" TEXT;
ALTER TABLE "mcp_pending_action" ADD COLUMN "objectKind" TEXT;
ALTER TABLE "mcp_pending_action" ADD COLUMN "objectId" TEXT;
ALTER TABLE "mcp_pending_action" ALTER COLUMN "connectionId" DROP NOT NULL;

-- Per-agent approval rules ("auto-run everything Sage proposes"). A NOT NULL
-- column with a '*' wildcard rather than a nullable one, because Postgres treats
-- NULLs as distinct in unique indexes and would accept many conflicting
-- "applies to every agent" rows — the same reasoning as integrationSlug/toolName.
ALTER TABLE "mcp_approval_policy" ADD COLUMN "agentScope" TEXT NOT NULL DEFAULT '*';
DROP INDEX IF EXISTS "mcp_approval_policy_organizationId_integrationSlug_toolName_key";
CREATE UNIQUE INDEX "mcp_approval_policy_scope_key"
    ON "mcp_approval_policy"("organizationId", "integrationSlug", "toolName", "agentScope");

-- ─── ActivityEvent ───────────────────────────────────────────────────────────

CREATE TABLE "activity_event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent",
    "actorKind" "ActorKind" NOT NULL,
    "actorUserId" TEXT,
    "verb" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "objectKind" TEXT,
    "objectId" TEXT,
    "runId" TEXT,
    "playId" TEXT,
    "pendingActionId" TEXT,
    "messageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_event_organizationId_createdAt_idx" ON "activity_event"("organizationId", "createdAt");
CREATE INDEX "activity_event_organizationId_agent_createdAt_idx" ON "activity_event"("organizationId", "agent", "createdAt");
CREATE INDEX "activity_event_objectKind_objectId_createdAt_idx" ON "activity_event"("objectKind", "objectId", "createdAt");
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── WorkObjectIndex ─────────────────────────────────────────────────────────
-- Derived from the typed tables and rebuildable via POST /internal/work-objects/reindex.

CREATE TABLE "work_object_index" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkObjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "dueAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "preview" JSONB,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_object_index_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "work_object_index_kind_sourceId_key" ON "work_object_index"("kind", "sourceId");
CREATE INDEX "work_object_index_org_agent_status_idx" ON "work_object_index"("organizationId", "agent", "status", "sourceUpdatedAt");
CREATE INDEX "work_object_index_organizationId_dueAt_idx" ON "work_object_index"("organizationId", "dueAt");
ALTER TABLE "work_object_index" ADD CONSTRAINT "work_object_index_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Insight ─────────────────────────────────────────────────────────────────

CREATE TABLE "insight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "severity" "InsightSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "InsightStatus" NOT NULL DEFAULT 'OPEN',
    "suggestedActionId" TEXT,
    "suggestedArgs" JSONB,
    "objectKind" TEXT,
    "objectId" TEXT,
    "runId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insight_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insight_organizationId_dedupeKey_key" ON "insight"("organizationId", "dedupeKey");
CREATE INDEX "insight_organizationId_agent_status_severity_idx" ON "insight"("organizationId", "agent", "status", "severity");
CREATE INDEX "insight_organizationId_status_createdAt_idx" ON "insight"("organizationId", "status", "createdAt");
ALTER TABLE "insight" ADD CONSTRAINT "insight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Handoff ─────────────────────────────────────────────────────────────────

CREATE TABLE "handoff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromAgent" "Agent",
    "toAgent" "Agent" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "requestedActionId" TEXT,
    "requestedArgs" JSONB,
    "note" TEXT NOT NULL DEFAULT '',
    "objectKind" TEXT,
    "objectId" TEXT,
    "status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "runId" TEXT,
    "sourceMessageId" TEXT,
    "resultMessageId" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handoff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "handoff_organizationId_toAgent_status_createdAt_idx" ON "handoff"("organizationId", "toAgent", "status", "createdAt");
CREATE INDEX "handoff_organizationId_fromAgent_status_createdAt_idx" ON "handoff"("organizationId", "fromAgent", "status", "createdAt");
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
