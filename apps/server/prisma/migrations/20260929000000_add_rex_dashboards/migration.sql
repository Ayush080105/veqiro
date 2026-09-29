-- Rex dashboards: prompt-built dashboards over uploaded or linked spreadsheets, editable on a
-- grid canvas and publishable at a public link.
--
-- rex_dashboard_result holds every tile's computed rows per filter state, so a public link is
-- served from stored rows and an anonymous visitor never makes the server run a query.
-- rex_dataset gains the fields a linked spreadsheet (Google Sheets, OneDrive, Dropbox, a direct
-- file URL) needs to be re-fetched on a schedule and skipped when unchanged.
--
-- Hand-written; this database has drift from migration history. Fully additive.

-- AlterTable
ALTER TABLE "rex_dataset" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "downloadUrl" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "sourceKind" TEXT NOT NULL DEFAULT 'upload',
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "syncError" TEXT;

-- CreateTable
CREATE TABLE "rex_dashboard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT,
    "datasetIds" TEXT[],
    "datasetAliases" JSONB NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "dataVersion" TEXT,
    "refreshStatus" TEXT NOT NULL DEFAULT 'idle',
    "refreshStartedAt" TIMESTAMP(3),
    "refreshError" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rex_dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rex_dashboard_widget" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sql" TEXT,
    "spec" JSONB NOT NULL,
    "layout" JSONB NOT NULL,
    "filterIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rex_dashboard_widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rex_dashboard_result" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "filterKey" TEXT NOT NULL,
    "dataVersion" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "error" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rex_dashboard_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rex_dashboard_shareToken_key" ON "rex_dashboard"("shareToken");

-- CreateIndex
CREATE INDEX "rex_dashboard_organizationId_updatedAt_idx" ON "rex_dashboard"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "rex_dashboard_widget_dashboardId_idx" ON "rex_dashboard_widget"("dashboardId");

-- CreateIndex
CREATE INDEX "rex_dashboard_result_dashboardId_dataVersion_idx" ON "rex_dashboard_result"("dashboardId", "dataVersion");

-- CreateIndex
CREATE UNIQUE INDEX "rex_dashboard_result_widgetId_filterKey_dataVersion_key" ON "rex_dashboard_result"("widgetId", "filterKey", "dataVersion");

-- CreateIndex
CREATE INDEX "rex_dataset_sourceKind_syncEnabled_idx" ON "rex_dataset"("sourceKind", "syncEnabled");

-- AddForeignKey
ALTER TABLE "rex_dashboard_widget" ADD CONSTRAINT "rex_dashboard_widget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "rex_dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

