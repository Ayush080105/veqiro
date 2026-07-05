/**
 * One-time backfill: fixes orgs whose subscription went active while the
 * DodoPayments webhook handler was broken (event_id/event_type field-name bug,
 * commit 941a5a1 → fix 00a4a16). During that window every webhook delivery
 * threw before syncOrgEntitlement ran, so affected orgs are stuck showing
 * "No agents unlocked" even though Dodo has them as a paying customer.
 *
 * Candidates: orgs that started a real checkout (pendingCheckoutSessionId set)
 * but never got the activation flip (dodoSubscriptionId still null, status
 * still TRIALING/EXPIRED). For each, checks Dodo's live API and — if Dodo
 * confirms an active subscription — reapplies exactly what
 * handleSubscriptionActive() would have applied.
 *
 * Safe to re-run: once a candidate is fixed, dodoSubscriptionId is set, so it
 * no longer matches the candidate query.
 *
 * Usage:
 *   pnpm --filter server reconcile:subscriptions            # dry run, no writes
 *   pnpm --filter server reconcile:subscriptions -- --apply  # apply the fixes
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { dodoClient } from "../src/lib/dodo.js";
import { syncOrgEntitlement } from "../src/modules/billing/billing.service.js";
import { resolvePlan, resolveEntitlementMode } from "../src/modules/billing/billing.types.js";
import { ALL_AGENTS } from "../src/modules/billing/billing.catalog.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "Running in APPLY mode — writes will be made." : "Running in DRY-RUN mode — no writes will be made (pass --apply to write).");

  const candidates = await prisma.subscription.findMany({
    where: {
      dodoSubscriptionId: null,
      status: { in: ["TRIALING", "EXPIRED"] },
      pendingCheckoutSessionId: { not: null },
    },
    include: { organization: { select: { name: true } } },
  });

  console.log(`Found ${candidates.length} candidate org(s) with an unconfirmed checkout.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const sub of candidates) {
    const orgLabel = `${sub.organization.name} (${sub.organizationId})`;

    const dodoSubs = await dodoClient.subscriptions.list({ customer_id: sub.dodoCustomerId });
    const active = dodoSubs.items?.find((s) => s.status === "active") ?? null;

    if (!active) {
      console.log(`  [skip] ${orgLabel} — no active Dodo subscription found (checkout likely abandoned)`);
      skipped++;
      continue;
    }

    const plan = resolvePlan(active.product_id) ?? sub.pendingPlan;
    const entitlementMode = resolveEntitlementMode(active.product_id) ?? sub.pendingEntitlementMode;
    const selectedAgents = entitlementMode === "CREW" ? ALL_AGENTS : sub.pendingSelectedAgents;

    if (!plan || !entitlementMode || !selectedAgents?.length) {
      console.log(`  [skip] ${orgLabel} — active in Dodo but couldn't resolve plan/entitlement (product_id=${active.product_id}), needs manual review`);
      skipped++;
      continue;
    }

    const currentPeriodEnd = new Date(active.next_billing_date);

    console.log(
      `  [${APPLY ? "fix" : "would fix"}] ${orgLabel} — plan=${plan} mode=${entitlementMode} agents=${selectedAgents.join(",")} dodoSubscriptionId=${active.subscription_id} periodEnd=${currentPeriodEnd.toISOString()}`
    );

    if (APPLY) {
      await syncOrgEntitlement(sub.organizationId, {
        status: "ACTIVE",
        plan,
        entitlementMode,
        selectedAgents,
        dodoSubscriptionId: active.subscription_id,
        currentPeriodEnd,
        trialEndsAt: null,
        cancelAtPeriodEnd: active.cancel_at_next_billing_date,
        pendingCheckoutSessionId: null,
        pendingPlan: null,
        pendingEntitlementMode: null,
        pendingSelectedAgents: [],
        pendingProductId: null,
        pendingCheckoutCreatedAt: null,
      });
      await prisma.mayaUsage.create({
        data: { organizationId: sub.organizationId, periodStart: new Date(), periodEnd: currentPeriodEnd },
      });
    }
    fixed++;
  }

  console.log(`\nDone. ${APPLY ? "Fixed" : "Would fix"}: ${fixed}, Skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Reconciliation failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
