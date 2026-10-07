-- Rex live data connections (HubSpot first): a stored, encrypted credential per organization and
-- the fields a connector-backed dataset needs to be synced incrementally.
--
-- Hand-written; this database has drift from migration history. Fully additive: new table, new
-- nullable columns, new indexes. Nothing existing is altered or dropped.

-- AlterTable
ALTER TABLE "rex_dataset" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "lastFullSyncAt" TIMESTAMP(3),
ADD COLUMN     "rowCount" INTEGER,
ADD COLUMN     "sourceObject" TEXT,
ADD COLUMN     "syncCursor" JSONB,
ADD COLUMN     "syncNote" TEXT,
ADD COLUMN     "syncStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rex_data_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "credentialEnc" TEXT NOT NULL,
    "accountLabel" TEXT,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rex_data_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rex_data_connection_organizationId_idx" ON "rex_data_connection"("organizationId");

-- CreateIndex
CREATE INDEX "rex_dataset_connectionId_idx" ON "rex_dataset"("connectionId");
