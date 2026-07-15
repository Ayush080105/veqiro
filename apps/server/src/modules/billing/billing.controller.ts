import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { createCheckoutForOrg, requireOrgOwner, startTrialForOrg } from "./billing.service.js";
import { cancelAgentAutoPay, resumeAgentAutoPay } from "./billing.cancel.js";
import { normalizeAgents } from "./billing.catalog.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

function daysRemaining(date: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export async function getStatus(req: Request, res: Response) {
  const organizationId = req.organizationId;
  if (!organizationId) throw new BadRequestError("No active organization selected");

  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      status: true,
      plan: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      dodoCustomerId: true,
      entitlementMode: true,
      selectedAgents: true,
      pendingCheckoutSessionId: true,
      pendingPlan: true,
      pendingEntitlementMode: true,
      pendingSelectedAgents: true,
    },
  });
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { unlockedAgents: true },
  });

  res.status(StatusCodes.OK).json({
    subscription: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          trialEndsAt: sub.trialEndsAt,
          currentPeriodEnd: sub.currentPeriodEnd,
          dodoCustomerId: sub.dodoCustomerId,
          entitlementMode: sub.entitlementMode,
          selectedAgents: sub.selectedAgents,
          unlockedAgents: org?.unlockedAgents ?? [],
          pendingCheckout: sub.pendingCheckoutSessionId
            ? {
                plan: sub.pendingPlan,
                entitlementMode: sub.pendingEntitlementMode,
                selectedAgents: sub.pendingSelectedAgents,
              }
            : null,
          daysRemaining:
            sub.status === "TRIALING" ? daysRemaining(sub.trialEndsAt) : null,
        }
      : null,
  });
}

// The `agents` body param is gone; trials are all-or-nothing.
export async function startTrial(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const result = await startTrialForOrg(orgId);
  res.status(StatusCodes.CREATED).json({
    status: "TRIALING",
    trialEndsAt: result.trialEndsAt,
    agents: result.agents,
  });
}

export async function createCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const checkout = await createCheckoutForOrg(orgId, {
    agent: req.body?.agent,
    cadence: req.body?.cadence,
    crew: req.body?.crew,
  });
  res.status(StatusCodes.OK).json(checkout);
}

export async function openPortal(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    select: { dodoCustomerId: true },
  });
  if (!sub?.dodoCustomerId) throw new BadRequestError("no-customer");

  const portal = await dodoClient.customers.customerPortal.create(sub.dodoCustomerId, {
    send_email: false,
  });
  res.status(StatusCodes.OK).json({ url: portal.link });
}

// Billing changes are owner-only — both routes go through requireOrgOwner.
export async function cancelAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await cancelAgentAutoPay(orgId, agent));
}

export async function resumeAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await resumeAgentAutoPay(orgId, agent));
}
