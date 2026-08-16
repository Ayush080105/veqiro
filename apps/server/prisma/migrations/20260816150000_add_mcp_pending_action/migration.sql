-- CreateEnum
CREATE TYPE "McpPendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateTable
CREATE TABLE "mcp_pending_action" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "messageId" TEXT,
    "connectionId" TEXT NOT NULL,
    "integrationSlug" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "McpPendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_pending_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_pending_action_organizationId_status_idx" ON "mcp_pending_action"("organizationId", "status");

-- CreateIndex
CREATE INDEX "mcp_pending_action_messageId_idx" ON "mcp_pending_action"("messageId");

-- AddForeignKey
ALTER TABLE "mcp_pending_action" ADD CONSTRAINT "mcp_pending_action_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

