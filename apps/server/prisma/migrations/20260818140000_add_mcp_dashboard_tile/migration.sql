-- CreateTable
CREATE TABLE "mcp_dashboard_tile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationSlug" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB,
    "noun" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_dashboard_tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_dashboard_tile_organizationId_integrationSlug_toolName_key" ON "mcp_dashboard_tile"("organizationId", "integrationSlug", "toolName");

-- CreateIndex
CREATE INDEX "mcp_dashboard_tile_organizationId_position_idx" ON "mcp_dashboard_tile"("organizationId", "position");
