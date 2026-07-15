/**
 * Backfill per-agent Entitlement rows from the legacy single-row Subscription
 * model.
 *
 *   DRY RUN (default, writes nothing):
 *     cd apps/server && npx tsx scripts/backfill-entitlements.ts
 *
 *   APPLY:
 *     cd apps/server && APPLY=1 npx tsx scripts/backfill-entitlements.ts
 *
 * Idempotent: an org that already has any Entitlement row is skipped, so
 * re-running never double-grants.
 *
 * Reads DATABASE_URL (the 6543 pooler is fine here -- this is DML, not DDL).
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { ALL_AGENTS, getAgentMonthlyPriceCents, getCrewPriceCents } from "../src/modules/billing/billing.catalog.js";
import type { Agent } from "../prisma/generated/prisma/client.js";

const APPLY = process.env.APPLY === "1";

type Plan = "MONTHLY" | "ANNUAL";

/** What we intend to do to one org, decided before any write. */
type Action =
  | { kind: "skip"; reason: string }
  | { kind: "trial"; agents: Agent[]; periodStart: Date; periodEnd: Date; expired: boolean }
  | {
      kind: "paid";
      agents: Agent[];
      plan: Plan;
      dodoSubscriptionId: string;
      periodStart: Date;
      periodEnd: Date;
      status: "ACTIVE" | "PAST_DUE";
      cancelAtPeriodEnd: boolean;
      isCrew: boolean;
      priceFor: (a: Agent) => number;
    };

async function main() {
  const subs = await prisma.subscription.findMany();
  const plans: Array<{ orgId: string; action: Action }> = [];
  const warnings: string[] = [];

  for (const sub of subs) {
    const existing = await prisma.entitlement.count({ where: { organizationId: sub.organizationId } });
    if (existing > 0) {
      plans.push({ orgId: sub.organizationId, action: { kind: "skip", reason: "already-has-entitlements" } });
      continue;
    }

    const isCrew = sub.entitlementMode === "CREW";
    const agents: Agent[] = isCrew ? ALL_AGENTS : sub.selectedAgents;

    if (agents.length === 0) {
      plans.push({ orgId: sub.organizationId, action: { kind: "skip", reason: "no-agents-selected" } });
      continue;
    }

    // --- Paid: a real Dodo subscription we can point a BillingSubscription at.
    if (sub.dodoSubscriptionId && sub.currentPeriodEnd) {
      const plan: Plan = (sub.plan ?? "MONTHLY") as Plan;
      // CREW price is divided across the six agents rather than stamping each at
      // full list price. If each Crew agent carried its own $9-$19, the org
      // would hold a $64 credit against a $39 Crew price and every future
      // upgrade quote would be permanently ineligible.
      const priceFor = (agent: Agent) =>
        isCrew ? Math.floor(getCrewPriceCents(plan) / ALL_AGENTS.length) : getAgentMonthlyPriceCents(agent);

      // CANCELLED is not an entitlement state in the new model: "cancelled but
      // still inside the paid period" IS ACTIVE + cancelAtPeriodEnd. Access
      // continues to currentPeriodEnd, matching today's behaviour
      // (deriveEntitlementFields maps CANCELLED -> expires at currentPeriodEnd).
      const status = sub.status === "PAST_DUE" ? "PAST_DUE" : "ACTIVE";

      if (!isCrew && agents.length > 1) {
        warnings.push(
          `LEGACY SHARED SUB: org ${sub.organizationId} has ONE Dodo subscription covering ` +
            `${agents.length} agents [${agents.join(",")}]. Per-agent auto-pay cancel cannot ` +
            `target one of them -- cancelling any will stop billing for all of them. ` +
            `Dodo allows only one subscription per checkout, so these cannot be split ` +
            `without the customer re-purchasing.`,
        );
      }

      plans.push({
        orgId: sub.organizationId,
        action: {
          kind: "paid",
          agents,
          plan,
          dodoSubscriptionId: sub.dodoSubscriptionId,
          periodStart: sub.updatedAt,
          periodEnd: sub.currentPeriodEnd,
          status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd || sub.status === "CANCELLED",
          isCrew,
          priceFor,
        },
      });
      continue;
    }

    // --- Trial-shaped: no Dodo subscription. Covers both genuine TRIALING rows
    // and rows an admin flipped to ACTIVE without a subscription ever existing.
    if (sub.trialEndsAt) {
      const expired = sub.trialEndsAt < new Date();
      if (sub.status === "ACTIVE") {
        warnings.push(
          `ADMIN-GRANTED ACTIVE: org ${sub.organizationId} is status=ACTIVE with NO ` +
            `dodoSubscriptionId and plan=${sub.plan}. Under the old middleware ` +
            `("if ACTIVE return next()") this org has UNLIMITED FREE ACCESS. ` +
            `Backfilling as TRIAL entitlements ending ${sub.trialEndsAt.toISOString().slice(0, 10)} ` +
            `-- it will lose access then, which is what its own trialEndsAt already says.`,
        );
      }
      plans.push({
        orgId: sub.organizationId,
        action: {
          kind: "trial",
          agents: ALL_AGENTS,
          periodStart: sub.createdAt,
          periodEnd: sub.trialEndsAt,
          expired,
        },
      });
      continue;
    }

    plans.push({ orgId: sub.organizationId, action: { kind: "skip", reason: "no-dodo-sub-and-no-trialEndsAt" } });
  }

  // ---- Report before writing anything.
  const counts = { skip: 0, trial: 0, paid: 0, entitlements: 0, billingSubs: 0, expiredTrials: 0 };
  for (const { action } of plans) {
    counts[action.kind]++;
    if (action.kind === "trial") {
      counts.entitlements += action.agents.length;
      if (action.expired) counts.expiredTrials++;
    }
    if (action.kind === "paid") {
      counts.entitlements += action.agents.length;
      counts.billingSubs++;
    }
  }

  console.log(`\n=== BACKFILL ${APPLY ? "APPLY" : "DRY RUN"} ===`);
  console.log(`subscriptions scanned : ${subs.length}`);
  console.log(`  -> skipped          : ${counts.skip}`);
  console.log(`  -> trial orgs       : ${counts.trial} (${counts.expiredTrials} already expired)`);
  console.log(`  -> paid orgs        : ${counts.paid}`);
  console.log(`entitlements to write : ${counts.entitlements}`);
  console.log(`billing subs to write : ${counts.billingSubs}`);

  if (warnings.length) {
    console.log(`\n=== WARNINGS (${warnings.length}) ===`);
    for (const w of warnings) console.log("  ! " + w + "\n");
  }

  if (!APPLY) {
    console.log("\nDRY RUN -- nothing written. Re-run with APPLY=1 to apply.\n");
    await prisma.$disconnect();
    return;
  }

  // ---- Write.
  let wrote = 0;
  for (const { orgId, action } of plans) {
    if (action.kind === "skip") continue;

    if (action.kind === "trial") {
      await prisma.$transaction(async (tx) => {
        await tx.entitlement.createMany({
          data: action.agents.map((agent) => ({
            organizationId: orgId,
            agent,
            source: "TRIAL" as const,
            // An already-lapsed trial is written as EXPIRED directly rather than
            // TRIALING-with-a-past-date, so the row states the truth without
            // waiting for the sweeper's first pass.
            status: action.expired ? ("EXPIRED" as const) : ("TRIALING" as const),
            currentPeriodStart: action.periodStart,
            currentPeriodEnd: action.periodEnd,
            priceCents: 0,
          })),
        });
        await tx.organization.update({
          where: { id: orgId },
          // Marks the one-per-org trial as used, so backfilled orgs cannot claim
          // a second free trial after this migration.
          data: { trialStartedAt: action.periodStart },
        });
      });
      wrote++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const bs = await tx.billingSubscription.create({
        data: {
          organizationId: orgId,
          dodoSubscriptionId: action.dodoSubscriptionId,
          plan: action.plan,
          status: action.status,
          currentPeriodEnd: action.periodEnd,
          cancelAtPeriodEnd: action.cancelAtPeriodEnd,
        },
      });
      await tx.entitlement.createMany({
        data: action.agents.map((agent) => ({
          organizationId: orgId,
          agent,
          source: action.isCrew ? ("CREW" as const) : ("AGENT" as const),
          status: action.status,
          currentPeriodStart: action.periodStart,
          currentPeriodEnd: action.periodEnd,
          cancelAtPeriodEnd: action.cancelAtPeriodEnd,
          priceCents: action.priceFor(agent),
          billingSubscriptionId: bs.id,
        })),
      });
    });
    wrote++;
  }

  console.log(`\nAPPLIED. orgs written: ${wrote}`);
  console.log(`entitlement rows now : ${await prisma.entitlement.count()}`);
  console.log(`billing_subscription : ${await prisma.billingSubscription.count()}\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("BACKFILL FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
