-- Adds MayaUsage.bonusCredits: extra credits purchased via a Maya credit
-- top-up, tracked separately from creditsUsed so "used" never goes negative
-- for display (the previous top-up implementation decremented creditsUsed
-- below zero to bank headroom, which is arithmetically correct for computing
-- `remaining` but renders as a broken negative number anywhere `used` is
-- shown directly, e.g. the usage progress bar).
--
-- HAND-CURATED, additive-only — same reason as prior migrations on this
-- branch: `prisma migrate diff` against the live datasource is unusable (the
-- DB has drifted from schema.prisma). Existing rows default to 0, which is a
-- no-op for every org that has never topped up.

-- AlterTable
ALTER TABLE "maya_usage" ADD COLUMN "bonusCredits" INTEGER NOT NULL DEFAULT 0;
