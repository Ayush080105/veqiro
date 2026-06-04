import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { requireOrgOwner, startTrialForOrg } from "./billing.service.js";
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
    },
  });

  res.status(StatusCodes.OK).json({
    subscription: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          trialEndsAt: sub.trialEndsAt,
          currentPeriodEnd: sub.currentPeriodEnd,
          dodoCustomerId: sub.dodoCustomerId,
          daysRemaining:
            sub.status === "TRIALING" ? daysRemaining(sub.trialEndsAt) : null,
        }
      : null,
  });
}

export async function startTrial(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const sub = await startTrialForOrg(orgId);
  res.status(StatusCodes.CREATED).json({
    status: sub.status,
    trialEndsAt: sub.trialEndsAt,
    plan: sub.plan,
  });
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
