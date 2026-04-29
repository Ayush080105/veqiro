-- C9: Tag datasets as actual or budget
ALTER TABLE "rex_dataset" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'actual';
CREATE INDEX "rex_dataset_organizationId_purpose_idx" ON "rex_dataset"("organizationId", "purpose");

-- C10: Public sharing for pinned cards
ALTER TABLE "rex_pinned_card" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "rex_pinned_card" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "rex_pinned_card_shareToken_key" ON "rex_pinned_card"("shareToken");
CREATE INDEX "rex_pinned_card_shareToken_idx" ON "rex_pinned_card"("shareToken");

-- C2: Threshold-based alert rules
ALTER TABLE "rex_settings" ADD COLUMN "alertRules" JSONB;

-- C3: Webhook ingest API key
ALTER TABLE "rex_settings" ADD COLUMN "ingestApiKey" TEXT;
CREATE UNIQUE INDEX "rex_settings_ingestApiKey_key" ON "rex_settings"("ingestApiKey");

-- C7: Column mapping memory
ALTER TABLE "rex_settings" ADD COLUMN "columnMappingTemplates" JSONB;
