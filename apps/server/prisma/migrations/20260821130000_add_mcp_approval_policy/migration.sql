-- Per-org rules for whether a proposed write needs a human. Absence of a rule
-- means ALWAYS_ASK, so this table starts empty and changes nothing until an
-- org deliberately relaxes something.

CREATE TYPE "McpApprovalMode" AS ENUM ('ALWAYS_ASK', 'AUTO_RUN', 'NEVER');

CREATE TABLE "mcp_approval_policy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    -- "*" rather than NULL: Postgres treats NULLs as distinct in unique
    -- indexes, so a nullable column would accept many conflicting
    -- "applies to everything" rules.
    "integrationSlug" TEXT NOT NULL DEFAULT '*',
    "toolName" TEXT NOT NULL DEFAULT '*',
    "mode" "McpApprovalMode" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mcp_approval_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_approval_policy_org_integration_tool_key"
  ON "mcp_approval_policy"("organizationId", "integrationSlug", "toolName");
CREATE INDEX "mcp_approval_policy_organizationId_idx"
  ON "mcp_approval_policy"("organizationId");
