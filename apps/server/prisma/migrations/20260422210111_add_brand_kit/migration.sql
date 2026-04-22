-- CreateTable
CREATE TABLE "brand_kit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT '',
    "company_description" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "target_audience" TEXT NOT NULL DEFAULT '',
    "brand_voice" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "mascot_url" TEXT,
    "brand_colors" JSONB NOT NULL DEFAULT '{}',
    "platform_tones" JSONB NOT NULL DEFAULT '{}',
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "key_differentiators" TEXT NOT NULL DEFAULT '',
    "website_url" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_kit_organizationId_key" ON "brand_kit"("organizationId");

-- CreateIndex
CREATE INDEX "brand_kit_organizationId_idx" ON "brand_kit"("organizationId");
