-- CreateTable
CREATE TABLE "mcp_tool_preference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agent" "Agent" NOT NULL,
    "preferredIntegrationSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_tool_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tool_preference_organizationId_agent_key" ON "mcp_tool_preference"("organizationId", "agent");

