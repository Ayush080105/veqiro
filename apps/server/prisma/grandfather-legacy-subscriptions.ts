/**
 * One-time migration: grandfathers pre-existing organizations that predate
 * the billing system into a trial. Legacy orgs have no `Subscription` row at
 * all (they were created before the credits/billing rollout), so unlike
 * `reconcile-stale-subscriptions.ts` (which fixes a broken activation flip on
 * orgs that DO have a Subscription) this script's candidates are orgs
 * missing the row entirely.
 *
 * For each candidate, calls the shared `startTrialForOrg` helper (see
 * `src/modules/billing/billing.service.ts`) — the same all-six-agents,
 * 7-day, once-ever trial normal owner-initiated signups get. It is guarded by
 * `Organization.trialStartedAt`, so a legacy org that was already granted a
 * trial by any other path (including a previous run of this script) is
 * skipped with an error logged rather than double-granted.
 *
 * Note this candidate query (`subscription: null`) and the guard
 * `startTrialForOrg` actually enforces (`trialStartedAt`) are different
 * fields — an org can in principle have no Subscription row yet already have
 * `trialStartedAt` stamped. That just means this script's candidate query is
 * a superset of the true target set; `startTrialForOrg` rejecting those with
 * "trial-already-used" is the correct, safe outcome, not a bug.
 *
 * Per-org processing is sequential (not `Promise.all`) with its own
 * try/catch, so one Dodo API hiccup (or an already-trialed org) logs and
 * moves on instead of aborting the whole run.
 *
 * Migration order: run this script FIRST to give every subscription-less org
 * its trial entitlements + initial MayaUsage row. Afterwards, re-run
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
import { startTrialForOrg } from "../src/modules/billing/billing.service.js";

const APPLY = process.argv.includes("--apply");

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

    console.log(`  [${APPLY ? "grandfathering" : "would grandfather"}] ${orgLabel} — trial`);

    if (!APPLY) {
      fixed++;
      continue;
    }

    try {
      await startTrialForOrg(org.id);
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
