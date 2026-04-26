-- AlterTable
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "value_proposition" TEXT NOT NULL DEFAULT '';
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "crawl_source" TEXT;
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "crawled_at" TIMESTAMPTZ;
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "crawled_content" TEXT;
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "crawled_summary" TEXT;
