-- CreateEnum
CREATE TYPE "Agent" AS ENUM ('MAYA', 'SAGE', 'LEX', 'MARK', 'SCOUT', 'VEGA');

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,
    "agent" "Agent" NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "userId" TEXT,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_agent_organizationId_idx" ON "message"("agent", "organizationId");
