import { prisma } from "../../config/prisma.js";
import { Agent, EntitlementStatus } from "../../../prisma/generated/prisma/client.js";

/**
 * Statuses that grant access. PAST_DUE is included deliberately: it IS the
 * dunning grace window, and the grace is the remainder of the already-paid
 * period — ended early only by a `subscription.failed` webhook flipping the
 * row to EXPIRED. SUPERSEDED never grants access.
 */
export const ACCESS_STATUSES: EntitlementStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

/**
 * Every entitlement currently granting access.
 *
 * Includes each row's billing cadence via its BillingSubscription — every
 * AGENT/CREW row has one (applyAgentActivation/applyCrewActivation always set
 * one), TRIAL rows never do (startTrialForOrg leaves billingSubscriptionId
 * null), so `billingSubscription?.plan` is the real per-row cadence rather
 * than the legacy, never-updated Subscription.plan column.
 */
export async function getActiveEntitlements(organizationId: string) {
  return prisma.entitlement.findMany({
    where: {
      organizationId,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    include: { billingSubscription: { select: { plan: true } } },
    orderBy: { currentPeriodEnd: "asc" },
  });
}

/**
 * Access check for one agent. Any covering row grants access — overlapping
 * rows (an AGENT row and a CREW row for the same agent) are legal.
 */
export async function hasAgentAccess(organizationId: string, agent: Agent): Promise<boolean> {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId,
      agent,
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    take: 1,
  });
  return rows.length > 0;
}

/**
 * Maya's governing entitlement, used for quota lookup. When rows overlap the
 * most generous one wins: AGENT outranks TRIAL, and among equals the later
 * period end wins.
 */
export async function getMayaEntitlement(organizationId: string) {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId,
      agent: "MAYA",
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
  });
  if (rows.length === 0) return null;
  const rank = { AGENT: 2, TRIAL: 1 } as const;
  return rows.sort((a, b) =>
    rank[b.source] - rank[a.source] ||
    b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime())[0];
}
