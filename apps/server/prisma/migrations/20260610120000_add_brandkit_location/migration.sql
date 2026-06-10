-- Add optional location field to brand_kit
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "location" TEXT;
