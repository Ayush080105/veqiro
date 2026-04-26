-- AlterTable
ALTER TABLE "brand_kit" ADD COLUMN "value_proposition" TEXT NOT NULL DEFAULT '';
ALTER TABLE "brand_kit" ADD COLUMN "crawled_content" TEXT;
ALTER TABLE "brand_kit" ADD COLUMN "crawled_summary" TEXT;
ALTER TABLE "brand_kit" ADD COLUMN "crawled_at" TIMESTAMP(3);
ALTER TABLE "brand_kit" ADD COLUMN "crawl_source" TEXT;
