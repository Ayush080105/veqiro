-- CreateTable
CREATE TABLE IF NOT EXISTS "rex_dataset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "unit" TEXT,
    "period" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rex_dataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "rex_dataset_organizationId_metricKey_idx" ON "rex_dataset"("organizationId", "metricKey");
