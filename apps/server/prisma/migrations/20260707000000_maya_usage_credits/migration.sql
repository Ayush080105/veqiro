-- Unify Maya's per-billing-period image/video quotas into a single credits balance.
-- Existing rows get creditsUsed = 0 via the column default (intentional reset,
-- see plan); periodStart/periodEnd are untouched.
ALTER TABLE "maya_usage" ADD COLUMN "creditsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "maya_usage" DROP COLUMN "imageCount";
ALTER TABLE "maya_usage" DROP COLUMN "videoSeconds";
