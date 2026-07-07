/**
 * One-time backfill: create maya_usage rows for TRIALING and ACTIVE orgs that
 * predate the credits system deploy. Safe to re-run — the NOT EXISTS guard
 * prevents double-inserts.
 *
 * Usage:
 *   pnpm --filter server backfill:maya-usage
 */
import "dotenv/config";
import { Client } from "pg";

const BACKFILL_TRIALING = `
  INSERT INTO maya_usage (id, "organizationId", "periodStart", "periodEnd", "creditsUsed", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    s."organizationId",
    NOW(),
    s."trialEndsAt",
    0, NOW(), NOW()
  FROM subscription s
  WHERE s.status = 'TRIALING'
    AND s."trialEndsAt" > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM maya_usage mu
      WHERE mu."organizationId" = s."organizationId" AND mu."periodEnd" > NOW()
    )
`;

const BACKFILL_ACTIVE = `
  INSERT INTO maya_usage (id, "organizationId", "periodStart", "periodEnd", "creditsUsed", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    s."organizationId",
    NOW(),
    s."currentPeriodEnd",
    0, NOW(), NOW()
  FROM subscription s
  WHERE s.status = 'ACTIVE'
    AND s."currentPeriodEnd" > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM maya_usage mu
      WHERE mu."organizationId" = s."organizationId" AND mu."periodEnd" > NOW()
    )
`;

// Not a backfill target — these rows are skipped by the INSERT queries above
// (correctly, since a NULL end date isn't a valid active period) but a NULL
// trialEndsAt/currentPeriodEnd on a TRIALING/ACTIVE subscription is itself a
// corrupt row that Task 2's self-healing won't fix retroactively. Surface
// them instead of silently dropping them so they get a manual look.
const SKIPPED_NULL_DATE_ROWS = `
  SELECT s."organizationId", s.status
  FROM subscription s
  WHERE (s.status = 'TRIALING' AND s."trialEndsAt" IS NULL)
     OR (s.status = 'ACTIVE' AND s."currentPeriodEnd" IS NULL)
`;

const client = new Client({ connectionString: process.env.DIRECT_URL });

async function main() {
  await client.connect();
  console.log("Connected via DIRECT_URL (port 5432)");

  const trialing = await client.query(BACKFILL_TRIALING);
  console.log(`Backfilled TRIALING orgs: ${trialing.rowCount} row(s) inserted`);

  const active = await client.query(BACKFILL_ACTIVE);
  console.log(`Backfilled ACTIVE orgs: ${active.rowCount} row(s) inserted`);

  const skipped = await client.query(SKIPPED_NULL_DATE_ROWS);
  if (skipped.rowCount) {
    console.warn(
      `[warn] ${skipped.rowCount} subscription(s) skipped — TRIALING/ACTIVE with a NULL end date (corrupt row, needs manual review):`,
    );
    for (const row of skipped.rows) {
      console.warn(`  [warn] organizationId=${row.organizationId} status=${row.status}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => client.end());
