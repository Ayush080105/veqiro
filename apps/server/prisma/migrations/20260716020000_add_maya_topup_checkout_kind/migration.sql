-- Adds a MAYA_TOPUP checkout kind and a nullable credits column on
-- PendingCheckout, for the one-time Maya credit top-up purchase flow (a
-- one-time Dodo payment, not a subscription — no billing cadence applies).
--
-- HAND-CURATED, additive-only — same reason as 20260716010000_add_pending_checkout:
-- `prisma migrate diff` against the live datasource is unusable (the DB has
-- drifted from schema.prisma and the generated diff contains destructive
-- DROP statements unrelated to this change). Every statement below is
-- CREATE/ALTER ... ADD. There is no DROP.

-- AlterEnum
ALTER TYPE "CheckoutKind" ADD VALUE 'MAYA_TOPUP';

-- AlterTable
ALTER TABLE "pending_checkout" ADD COLUMN "credits" INTEGER;
