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
 * getMayaEntitlement in entitlement.service.ts): an org can hold an AGENT row
 * and a CREW row for the same agent at once, because purchases insert new
 * rows alongside old ones rather than replacing them, and nothing sets
 * SUPERSEDED yet. Per-agent cancel must never resolve to the Crew bundle's
 * subscription — cancelling Crew cancels all six agents, which is a
 * different, much bigger action than the one the caller asked for, and the
 * shared-subscription guard below only counts AGENT-source siblings, so it
 * would not catch a Crew subscription slipping through here. So this
 * function filters to `source: "AGENT"` explicitly and, when no AGENT row
 * covers the agent, distinguishes "covered only by Crew" (refuse — the UI
 * must offer a separate "cancel Crew" action) from "covered only by trial"
 * and "not entitled at all" (existing behaviour, unchanged).
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
    if (rows.some((r) => r.source === "CREW")) throw new BadRequestError(`covered-by-crew:${agent}`);
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
 * Scoped to `source: "AGENT"` only: a CREW subscription legitimately has all
 * six entitlements attached, and cancelling Crew is a separate, correct
 * all-six action that must not be caught by this guard. Only rows still
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

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: true },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: true } }),
  ]);

  return { activeUntil: row.currentPeriodEnd };
}

/**
 * Resumes auto-pay for one agent.
 *
 * No shared-subscription guard here on purpose: resuming a subscription that
 * bills more than one agent (the legacy backfill case above, or a legitimate
 * CREW subscription) flips `cancelAtPeriodEnd` back to false for every row on
 * it. That is harmless — nobody loses access and nobody is charged more than
 * they already agreed to — so it is allowed to proceed for all agents on the
 * subscription.
 */
export async function resumeAgentAutoPay(organizationId: string, agent: Agent) {
  const { row, bs } = await resolveAgentSubscription(organizationId, agent);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: false });

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: false },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: false } }),
  ]);

  return { renewsOn: row.currentPeriodEnd };
}
