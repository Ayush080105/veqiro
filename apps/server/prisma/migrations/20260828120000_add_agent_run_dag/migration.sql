-- Planned multi-step runs (AgentRun / AgentRunStep).
--
-- Hand-written rather than produced by `prisma migrate dev`: this database
-- has pre-existing drift from the migration history, so the generated diff
-- also wanted to remove conversation_memories and rag_chunks (created by
-- apps/ai's CREATE TABLE IF NOT EXISTS, so invisible to Prisma) along with
-- community_post, community_comment and post_analytics. Only the statements
-- belonging to this feature are included here.

CREATE TYPE "AgentRunStatus" AS ENUM ('PLANNING', 'AWAITING_PLAN_APPROVAL', 'RUNNING', 'AWAITING_ACTION_APPROVAL', 'REPLANNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'REJECTED');

CREATE TYPE "AgentRunStepStatus" AS ENUM ('PLANNED', 'DISABLED', 'BLOCKED', 'READY', 'RUNNING', 'AWAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'SKIPPED');

CREATE TYPE "AgentRunTrigger" AS ENUM ('CHAT', 'TRIGGER', 'PLAY');

ALTER TABLE "mcp_pending_action" ADD COLUMN     "runStepId" TEXT;

ALTER TABLE "organization" ADD COLUMN     "plannedRunsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "agent_run" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "trigger" "AgentRunTrigger" NOT NULL DEFAULT 'CHAT',
    "requestText" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PLANNING',
    "goal" TEXT NOT NULL DEFAULT '',
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "plannerMeta" JSONB,
    "approvedWrites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "summary" TEXT,
    "errorMessage" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "resumeCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_run_step" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "agent" "Agent" NOT NULL,
    "title" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "integrationSlug" TEXT,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "expectedScope" TEXT,
    "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AgentRunStepStatus" NOT NULL DEFAULT 'PLANNED',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "toolTrace" JSONB,
    "outputText" TEXT,
    "actionId" TEXT,
    "actionResult" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_run_step_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_run_organizationId_status_idx" ON "agent_run"("organizationId", "status");

CREATE INDEX "agent_run_organizationId_agent_createdAt_idx" ON "agent_run"("organizationId", "agent", "createdAt");

CREATE INDEX "agent_run_status_heartbeatAt_idx" ON "agent_run"("status", "heartbeatAt");

CREATE INDEX "agent_run_step_runId_status_idx" ON "agent_run_step"("runId", "status");

CREATE UNIQUE INDEX "agent_run_step_runId_key_key" ON "agent_run_step"("runId", "key");

CREATE INDEX "mcp_pending_action_runStepId_idx" ON "mcp_pending_action"("runStepId");

ALTER TABLE "mcp_pending_action" ADD CONSTRAINT "mcp_pending_action_runStepId_fkey" FOREIGN KEY ("runStepId") REFERENCES "agent_run_step"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_run_step" ADD CONSTRAINT "agent_run_step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
