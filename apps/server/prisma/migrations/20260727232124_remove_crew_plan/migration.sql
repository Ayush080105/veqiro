-- Removes the Crew (bundled all-6-agents) subscription plan. No production
-- subscribers exist on Crew, so this is a straight removal, not a backfill.
--
-- HAND-CURATED — same reason as prior migrations in this directory:
-- `prisma migrate diff` against the live, drifted datasource is unusable.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so each enum is recreated:
-- rename the old type, create the new type without the removed value(s),
-- cast the column across, drop the old type. Any pre-existing CREW-source
-- rows (dev/test data only — no production Crew subscribers exist) are
-- deleted first, since the cast below would otherwise fail on them.

-- Clean up any dev/test rows using the values being removed.
DELETE FROM "entitlement" WHERE "source" = 'CREW';
DELETE FROM "pending_checkout" WHERE "kind" IN ('CREW', 'CREW_UPGRADE');

-- EntitlementSource: TRIAL | AGENT | CREW -> TRIAL | AGENT
ALTER TYPE "EntitlementSource" RENAME TO "EntitlementSource_old";
CREATE TYPE "EntitlementSource" AS ENUM ('TRIAL', 'AGENT');
ALTER TABLE "entitlement" ALTER COLUMN "source" TYPE "EntitlementSource" USING ("source"::text::"EntitlementSource");
DROP TYPE "EntitlementSource_old";

-- CheckoutKind: AGENT | CREW | CREW_UPGRADE | MAYA_TOPUP -> AGENT | MAYA_TOPUP
ALTER TYPE "CheckoutKind" RENAME TO "CheckoutKind_old";
CREATE TYPE "CheckoutKind" AS ENUM ('AGENT', 'MAYA_TOPUP');
ALTER TABLE "pending_checkout" ALTER COLUMN "kind" TYPE "CheckoutKind" USING ("kind"::text::"CheckoutKind");
DROP TYPE "CheckoutKind_old";

-- SubscriptionEntitlementMode: CREW | CUSTOM -> CUSTOM only. Existing rows
-- default to CREW; repoint them to CUSTOM before narrowing the type. This
-- field is dead (nothing writes it after this migration) but must not be
-- left pointing at a value that no longer exists.
--
-- Two columns use this type: entitlementMode (repointed to CUSTOM, since it
-- always holds a value) and pendingEntitlementMode (nullable — repointed to
-- NULL rather than CUSTOM, since NULL is what "no pending entitlement mode
-- change" means elsewhere in this column; no CUSTOM-mode checkout was
-- actually pending for any CREW-valued row).
UPDATE "subscription" SET "entitlementMode" = 'CUSTOM' WHERE "entitlementMode" = 'CREW';
UPDATE "subscription" SET "pendingEntitlementMode" = NULL WHERE "pendingEntitlementMode" = 'CREW';
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" DROP DEFAULT;
ALTER TYPE "SubscriptionEntitlementMode" RENAME TO "SubscriptionEntitlementMode_old";
CREATE TYPE "SubscriptionEntitlementMode" AS ENUM ('CUSTOM');
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" TYPE "SubscriptionEntitlementMode" USING ("entitlementMode"::text::"SubscriptionEntitlementMode");
ALTER TABLE "subscription" ALTER COLUMN "pendingEntitlementMode" TYPE "SubscriptionEntitlementMode" USING ("pendingEntitlementMode"::text::"SubscriptionEntitlementMode");
ALTER TABLE "subscription" ALTER COLUMN "entitlementMode" SET DEFAULT 'CUSTOM';
DROP TYPE "SubscriptionEntitlementMode_old";
