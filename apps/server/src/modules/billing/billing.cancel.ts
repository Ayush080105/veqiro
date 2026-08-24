import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { Agent } from "../../../prisma/generated/prisma/client.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { ACCESS_STATUSES } from "./entitlement.service.js";

/**
 * Resolves the AGENT-source entitlement (and its BillingSubscription) that
 * per-agent cancel/resume must act on.
 *
 * Overlapping rows for the same agent are legal and documented (see
 * getMayaEntitlement in entitlement.service.ts): purchases insert new rows
 * alongside old ones rather than replacing them, and nothing sets SUPERSEDED
 * yet. So this function filters to `source: "AGENT"` explicitly and, when no
 * AGENT row covers the agent, distinguishes "covered only by trial" from
 * "not entitled at all".
 *
 * When more than one AGENT row somehow covers the agent, the one with the
 * latest currentPeriodEnd wins — never unordered row order.
 */
async function resolveAgentSubscription(organizationId: string, agent: Agent) {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId, agent,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });
  const row = rows.find((r) => r.source === "AGENT");
  if (!row) {
    if (rows.some((r) => r.source === "TRIAL")) throw new BadRequestError("no-subscription-for-agent");
    throw new BadRequestError(`not-entitled:${agent}`);
  }
  if (!row.billingSubscriptionId) throw new BadRequestError("no-subscription-for-agent");
  const bs = await prisma.billingSubscription.findUnique({ where: { id: row.billingSubscriptionId } });
  if (!bs) throw new BadRequestError("no-subscription-for-agent");
  return { row, bs };
}

/**
 * Guards against a real production data shape that the "one agent = one
 * checkout = one Dodo subscription" invariant does not cover: two paying
 * orgs (iR4Rrtvs3UCE3uERARfbeDVNtd1VVAQD: MAYA+REX,
 * EqlgflYLcEVpsNCaHwIVjGuzUfyy4pHL: MAYA+SAGE) were backfilled from an old
 * pricing hack where a single "custom" Dodo product was billed by quantity,
 * leaving ONE BillingSubscription covering TWO AGENT-source entitlements.
 *
 * For those orgs, cancelling one agent's auto-pay would silently cancel the
 * other agent too if we just flipped every entitlement on the subscription.
 * Dodo permits only one subscription per checkout, so this subscription
 * cannot be split server-side — the customer would have to re-purchase.
 * Refusing here is the honest behaviour; the caller surfaces the agent list
 * so the UI/support can explain why.
 *
 * Scoped to `source: "AGENT"` only: TRIAL rows have no real Dodo subscription
 * to conflict over, so they are irrelevant to this guard. Only rows still
 * granting access (status in ACCESS_STATUSES and currentPeriodEnd in the
 * future) count — an already-expired sibling must not block a cancel.
 */
async function assertNotSharedSubscription(billingSubscriptionId: string) {
  const siblings = await prisma.entitlement.findMany({
    where: {
      billingSubscriptionId,
      source: "AGENT",
      status: { in: ACCESS_STATUSES },
      currentPeriodEnd: { gt: new Date() },
    },
  });
  if (siblings.length > 1) {
    const agents = [...new Set(siblings.map((e) => e.agent as string))].sort();
    throw new BadRequestError(`shared-subscription:${agents.join(",")}`);
  }
}

/**
 * Stops auto-pay for one agent without touching any other agent.
 *
 * Access is deliberately retained to currentPeriodEnd — the period is already
 * paid for. Only the renewal is cancelled. The sweeper expires the row when
 * the period lapses.
 */
export async function cancelAgentAutoPay(organizationId: string, agent: Agent) {
  const { row, bs } = await resolveAgentSubscription(organizationId, agent);

  await assertNotSharedSubscription(bs.id);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: true });

  try {
    await prisma.$transaction([
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
        data: { cancelAtPeriodEnd: true },
      }),
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: true } }),
    ]);
  } catch (err) {
    // Dodo has ALREADY been told to stop renewing (call above succeeded) —
    // access is unaffected either way (still governed by currentPeriodEnd),
    // but the local cancelAtPeriodEnd flag is now stale (says "will renew"
    // when Dodo will not). Loud, specific log rather than a generic 500 so
    // this is discoverable and the row can be corrected by hand.
    console.error(
      "[billing] cancelAgentAutoPay: Dodo update succeeded but the local write failed — cancelAtPeriodEnd is now stale",
      { organizationId, agent, billingSubscriptionId: bs.id, dodoSubscriptionId: bs.dodoSubscriptionId },
      err,
    );
    throw err;
  }

  return { activeUntil: row.currentPeriodEnd };
}

/**
 * Resumes auto-pay for one agent.
 *
 * No shared-subscription guard here on purpose: resuming a subscription that
 * bills more than one agent (the legacy backfill case above) flips
 * `cancelAtPeriodEnd` back to false for every row on it. That is harmless —
 * nobody loses access and nobody is charged more than they already agreed to
 * — so it is allowed to proceed for all agents on the subscription.
 */
export async function resumeAgentAutoPay(organizationId: string, agent: Agent) {
  const { row, bs } = await resolveAgentSubscription(organizationId, agent);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: false });

  try {
    await prisma.$transaction([
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
        data: { cancelAtPeriodEnd: false },
      }),
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: false } }),
    ]);
  } catch (err) {
    // Same divergence risk as cancelAgentAutoPay's catch, mirrored here:
    // Dodo has already been told to resume renewing.
    console.error(
      "[billing] resumeAgentAutoPay: Dodo update succeeded but the local write failed — cancelAtPeriodEnd is now stale",
      { organizationId, agent, billingSubscriptionId: bs.id, dodoSubscriptionId: bs.dodoSubscriptionId },
      err,
    );
    throw err;
  }

  return { renewsOn: row.currentPeriodEnd };
}
