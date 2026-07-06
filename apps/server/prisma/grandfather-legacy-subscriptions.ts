/**
 * One-time migration: grandfathers pre-existing organizations that predate
 * the billing system into a trial. Legacy orgs have no `Subscription` row at
 * all (they were created before the credits/billing rollout), so unlike
 * `reconcile-stale-subscriptions.ts` (which fixes a broken activation flip on
 * orgs that DO have a Subscription) this script's candidates are orgs
 * missing the row entirely.
 *
 * For each candidate, calls the shared `startOrExtendTrial` helper (see
 * `src/modules/billing/billing.service.ts`), which — for an org with no
 * existing Subscription — creates the Dodo customer, the Subscription row
 * (status TRIALING), flips the Organization entitlement cache, and opens the
 * initial MayaUsage period, all in one transaction.
 *
 * Trial length defaults to 7 days, matching `startTrialForOrg`'s default for
 * consistency with normal owner-initiated trials. If a longer grace window is
 * wanted for these already-established orgs, adjust TRIAL_DAYS below — this
 * is a one-line change, called out here since it wasn't decided as part of
 * this task.
 *
 * Safe to re-run (idempotent): the candidate query is a `subscription: null`
 * filter, so once an org has been given a Subscription row (by this script or
 * any other path), it no longer matches and won't be touched again.
 *
 * Per-org processing is sequential (not `Promise.all`) with its own
 * try/catch, so one Dodo API hiccup logs and moves on instead of aborting the
 * whole run.
 *
 * Migration order: run this script FIRST to give every subscription-less org
 * a Subscription + initial MayaUsage row. Afterwards, re-run
 * `backfill-maya-usage.ts` as a defensive second pass — it catches any
 * TRIALING/ACTIVE subscriptions from other historical causes (not the
 * "missing Subscription entirely" case this script handles) that are still
 * missing a maya_usage row.
 *
 * Usage:
 *   pnpm --filter server grandfather:legacy-subscriptions            # dry run, no writes
 *   pnpm --filter server grandfather:legacy-subscriptions -- --apply  # apply the fixes
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { startOrExtendTrial } from "../src/modules/billing/billing.service.js";

const APPLY = process.argv.includes("--apply");
const TRIAL_DAYS = 7;

async function main() {
  console.log(
    APPLY
      ? "Running in APPLY mode — writes will be made."
      : "Running in DRY-RUN mode — no writes will be made (pass --apply to write).",
  );

  const candidates = await prisma.organization.findMany({
    where: { subscription: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${candidates.length} organization(s) with no Subscription row.\n`);

  let fixed = 0;
  let failed = 0;

  for (const org of candidates) {
    const orgLabel = `${org.name} (${org.id})`;

    console.log(`  [${APPLY ? "grandfathering" : "would grandfather"}] ${orgLabel} — ${TRIAL_DAYS}-day trial`);

    if (!APPLY) {
      fixed++;
      continue;
    }

    try {
      await startOrExtendTrial(org.id, TRIAL_DAYS);
      fixed++;
    } catch (err) {
      console.error(`  [error] ${orgLabel} — failed to grandfather:`, err);
      failed++;
    }
  }

  console.log(`\nDone. ${APPLY ? "Fixed" : "Would fix"}: ${fixed}, Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error("Grandfathering migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
