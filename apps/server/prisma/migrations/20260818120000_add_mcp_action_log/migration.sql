-- CreateTable
CREATE TABLE "mcp_action_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent",
    "integrationSlug" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_action_log_organizationId_createdAt_idx" ON "mcp_action_log"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_action_log_organizationId_integrationSlug_idx" ON "mcp_action_log"("organizationId", "integrationSlug");
