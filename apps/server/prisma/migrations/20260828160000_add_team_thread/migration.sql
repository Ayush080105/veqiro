-- Shared team thread: isTeam on message and agent_run.
--
-- Hand-written for the same reason as the agent_run migration: this
-- database has pre-existing drift, so the generated diff also wants to
-- drop conversation_memories, rag_chunks and three other tables.

ALTER TABLE "agent_run" ADD COLUMN     "isTeam" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "message" ADD COLUMN     "isTeam" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "message_organizationId_isTeam_createdAt_idx" ON "message"("organizationId", "isTeam", "createdAt");
