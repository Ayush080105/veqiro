import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { ACCESS_STATUSES } from "./entitlement.service.js";

/**
 * Resolves the org's active Crew BillingSubscription via any one of its six
 * CREW-source entitlement rows (they all share one billingSubscriptionId,
 * per applyCrewActivation). Unlike resolveAgentSubscription in
 * billing.cancel.ts, there is no shared-subscription guard here — a Crew
 * subscription legitimately bills all six agents at once; that is what Crew
 * means, not a legacy anomaly to refuse.
 */
async function resolveCrewSubscription(organizationId: string) {
  const rows = await prisma.entitlement.findMany({
    where: {
      organizationId,
      source: "CREW",
      currentPeriodEnd: { gt: new Date() },
      status: { in: ACCESS_STATUSES },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });
  const billingSubscriptionId = rows[0]?.billingSubscriptionId;
  if (!billingSubscriptionId) throw new BadRequestError("no-crew-subscription");

  const bs = await prisma.billingSubscription.findUnique({ where: { id: billingSubscriptionId } });
  if (!bs) throw new BadRequestError("no-crew-subscription");

  return { row: rows[0], bs };
}

/**
 * Stops auto-pay for the whole Crew subscription — all six agents together,
 * which is what "cancelling Crew" means. Access is retained to
 * currentPeriodEnd; only the renewal is cancelled. Every write below is
 * scoped to `source: "CREW"` so it can never touch a same-org AGENT row
 * (e.g. a SUPERSEDED row left over from an earlier upgrade).
 */
export async function cancelCrewAutoPay(organizationId: string) {
  const { row, bs } = await resolveCrewSubscription(organizationId);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: true });

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, source: "CREW", status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: true },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: true } }),
  ]);

  return { activeUntil: row.currentPeriodEnd };
}

/** Resumes auto-pay for the Crew subscription — all six agents together. */
export async function resumeCrewAutoPay(organizationId: string) {
  const { row, bs } = await resolveCrewSubscription(organizationId);

  await dodoClient.subscriptions.update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: false });

  await prisma.$transaction([
    prisma.entitlement.updateMany({
      where: { billingSubscriptionId: bs.id, source: "CREW", status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { cancelAtPeriodEnd: false },
    }),
    prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: false } }),
  ]);

  return { renewsOn: row.currentPeriodEnd };
}
