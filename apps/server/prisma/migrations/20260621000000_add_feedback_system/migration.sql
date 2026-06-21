-- Feedback / Voting system tables.
-- Additive only: creates 2 enum types + 5 tables (with indexes & FKs).
-- Intentionally excludes the unrelated drift shown by `migrate diff`
-- (drops/renames of task, rag_chunks, post_analytics, conversation_memories,
-- and index/constraint renames) so existing data is untouched.

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'LAUNCHED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('FEATURE_REQUEST', 'BUG_REPORT', 'INTEGRATION', 'NEW_AGENT', 'UX_IMPROVEMENT', 'GENERAL');

-- CreateTable
CREATE TABLE "feedback_post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'GENERAL',
    "agentSlug" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "roadmapEta" TEXT,
    "adminReply" TEXT,
    "adminNote" TEXT,
    "isMerged" BOOLEAN NOT NULL DEFAULT false,
    "mergedIntoId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "isAdminReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upcoming_agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_agent_vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upcomingAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upcoming_agent_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_post_status_idx" ON "feedback_post"("status");

-- CreateIndex
CREATE INDEX "feedback_post_category_idx" ON "feedback_post"("category");

-- CreateIndex
CREATE INDEX "feedback_post_agentSlug_idx" ON "feedback_post"("agentSlug");

-- CreateIndex
CREATE INDEX "feedback_post_createdById_idx" ON "feedback_post"("createdById");

-- CreateIndex
CREATE INDEX "feedback_post_voteCount_idx" ON "feedback_post"("voteCount");

-- CreateIndex
CREATE INDEX "feedback_post_createdAt_idx" ON "feedback_post"("createdAt");

-- CreateIndex
CREATE INDEX "feedback_vote_userId_idx" ON "feedback_vote"("userId");

-- CreateIndex
CREATE INDEX "feedback_vote_feedbackId_idx" ON "feedback_vote"("feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_vote_userId_feedbackId_key" ON "feedback_vote"("userId", "feedbackId");

-- CreateIndex
CREATE INDEX "feedback_comment_feedbackId_idx" ON "feedback_comment"("feedbackId");

-- CreateIndex
CREATE INDEX "feedback_comment_userId_idx" ON "feedback_comment"("userId");

-- CreateIndex
CREATE INDEX "upcoming_agent_isVisible_order_idx" ON "upcoming_agent"("isVisible", "order");

-- CreateIndex
CREATE INDEX "upcoming_agent_vote_userId_idx" ON "upcoming_agent_vote"("userId");

-- CreateIndex
CREATE INDEX "upcoming_agent_vote_upcomingAgentId_idx" ON "upcoming_agent_vote"("upcomingAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "upcoming_agent_vote_userId_upcomingAgentId_key" ON "upcoming_agent_vote"("userId", "upcomingAgentId");

-- AddForeignKey
ALTER TABLE "feedback_post" ADD CONSTRAINT "feedback_post_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_vote" ADD CONSTRAINT "feedback_vote_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comment" ADD CONSTRAINT "feedback_comment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_agent_vote" ADD CONSTRAINT "upcoming_agent_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_agent_vote" ADD CONSTRAINT "upcoming_agent_vote_upcomingAgentId_fkey" FOREIGN KEY ("upcomingAgentId") REFERENCES "upcoming_agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
