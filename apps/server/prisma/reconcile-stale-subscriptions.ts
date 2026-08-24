/**
 * Break-glass reconciliation: finds orgs whose AGENT checkout succeeded at
 * Dodo but never got provisioned locally — e.g. the `subscription.active`
 * webhook was dropped, or its handler threw and the retry never landed.
 * For each candidate, checks Dodo's live API and — if Dodo confirms an
 * active subscription for that agent's product — reapplies exactly what
 * handleSubscriptionActive() would have applied.
 *
 * Rewritten (2026-08-24) for the per-agent Entitlement model. The previous
 * version targeted the retired single-row Subscription model
 * (`syncOrgEntitlement`, `billing.types.ts` — both deleted) and no longer
 * ran at all; it failed at import time.
 *
 * Candidates: PendingCheckout rows (kind=AGENT) older than STALE_MINUTES.
 * Unlike the webhook handler — which deliberately never lets PendingCheckout
 * decide `agent`/`plan` (see resolveActivationIntent's doc comment in
 * billing.webhooks.ts) — this script MAY use it as a lead, because a human
 * reviews the dry-run output before `--apply`, and every candidate is
 * independently cross-checked against Dodo's own subscription status and
 * product_id before anything is written.
 *
 * Safe to re-run: a fixed candidate's PendingCheckout row is deleted once
 * applied, so it won't be picked up again. An already-provisioned match
 * (dodoSubscriptionId already has a BillingSubscription — e.g. the original
 * webhook actually succeeded and only left a stray PendingCheckout row) is
 * skipped for provisioning but still has its stale row cleared.
 *
 * Usage:
 *   pnpm --filter server reconcile:subscriptions            # dry run, no writes
 *   pnpm --filter server reconcile:subscriptions -- --apply  # apply the fixes
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { dodoClient } from "../src/lib/dodo.js";
import { applyAgentActivation } from "../src/modules/billing/billing.webhooks.js";
import { resolveAgentFromProductId } from "../src/modules/billing/billing.catalog.js";

const APPLY = process.argv.includes("--apply");
const STALE_MINUTES = 10;

async function main() {
  console.log(APPLY ? "Running in APPLY mode — writes will be made." : "Running in DRY-RUN mode — no writes will be made (pass --apply to write).");

  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const candidates = await prisma.pendingCheckout.findMany({
    where: { kind: "AGENT", createdAt: { lt: staleBefore } },
    include: { organization: { select: { name: true } } },
  });

  console.log(`Found ${candidates.length} candidate pending checkout(s) older than ${STALE_MINUTES}m.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const pc of candidates) {
    const orgLabel = `${pc.organization.name} (${pc.organizationId})`;

    if (!pc.agent) {
      console.log(`  [skip] ${orgLabel} — pending checkout has no agent`);
      skipped++;
      continue;
    }

    const sub = await prisma.subscription.findUnique({ where: { organizationId: pc.organizationId } });
    if (!sub) {
      console.log(`  [skip] ${orgLabel} — no Dodo customer on file`);
      skipped++;
      continue;
    }

    const dodoSubs = await dodoClient.subscriptions.list({ customer_id: sub.dodoCustomerId });
    const match = dodoSubs.items?.find(
      (s) => s.status === "active" && resolveAgentFromProductId(s.product_id) === pc.agent,
    ) ?? null;

    if (!match) {
      console.log(`  [skip] ${orgLabel} — no active Dodo subscription found for ${pc.agent} (checkout likely abandoned)`);
      skipped++;
      continue;
    }

    const alreadyProvisioned = await prisma.billingSubscription.findUnique({
      where: { dodoSubscriptionId: match.subscription_id },
    });
    if (alreadyProvisioned) {
      console.log(`  [skip] ${orgLabel} — ${pc.agent} already provisioned (dodoSubscriptionId=${match.subscription_id}); clearing stale PendingCheckout only`);
      if (APPLY) await prisma.pendingCheckout.delete({ where: { id: pc.id } }).catch(() => {});
      skipped++;
      continue;
    }

    const periodEnd = new Date(match.next_billing_date);
    console.log(
      `  [${APPLY ? "fix" : "would fix"}] ${orgLabel} — agent=${pc.agent} dodoSubscriptionId=${match.subscription_id} periodEnd=${periodEnd.toISOString()}`,
    );

    if (APPLY) {
      await applyAgentActivation({
        organizationId: pc.organizationId,
        dodoSubscriptionId: match.subscription_id,
        agent: pc.agent,
        periodEnd,
      });
      await prisma.pendingCheckout.delete({ where: { id: pc.id } }).catch(() => {});
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
