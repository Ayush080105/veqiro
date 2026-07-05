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
  INSERT INTO maya_usage (id, "organizationId", "periodStart", "periodEnd", "imageCount", "videoSeconds", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    s."organizationId",
    NOW(),
    s."trialEndsAt",
    0, 0, NOW(), NOW()
  FROM subscription s
  WHERE s.status = 'TRIALING'
    AND s."trialEndsAt" > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM maya_usage mu
      WHERE mu."organizationId" = s."organizationId" AND mu."periodEnd" > NOW()
    )
`;

const BACKFILL_ACTIVE = `
  INSERT INTO maya_usage (id, "organizationId", "periodStart", "periodEnd", "imageCount", "videoSeconds", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    s."organizationId",
    NOW(),
    s."currentPeriodEnd",
    0, 0, NOW(), NOW()
  FROM subscription s
  WHERE s.status = 'ACTIVE'
    AND s."currentPeriodEnd" > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM maya_usage mu
      WHERE mu."organizationId" = s."organizationId" AND mu."periodEnd" > NOW()
    )
`;

const client = new Client({ connectionString: process.env.DIRECT_URL });

async function main() {
  await client.connect();
  console.log("Connected via DIRECT_URL (port 5432)");

  const trialing = await client.query(BACKFILL_TRIALING);
  console.log(`Backfilled TRIALING orgs: ${trialing.rowCount} row(s) inserted`);

  const active = await client.query(BACKFILL_ACTIVE);
  console.log(`Backfilled ACTIVE orgs: ${active.rowCount} row(s) inserted`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => client.end());
