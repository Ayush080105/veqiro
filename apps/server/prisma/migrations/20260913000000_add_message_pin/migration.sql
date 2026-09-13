-- Pin support for long-running agent chats (Phase 3: lightweight thread
-- primitives, not a Conversation/Thread model).
--
-- Hand-written for the same reason as the isTeam and triggerEventId
-- migrations: this database has pre-existing drift from migration history,
-- so `prisma migrate dev` refuses to generate a diff without a full reset.

ALTER TABLE "message" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "message" ADD COLUMN     "pinnedAt" TIMESTAMP(3);

CREATE INDEX "message_organizationId_agent_pinned_pinnedAt_idx" ON "message"("organizationId", "agent", "pinned", "pinnedAt");
