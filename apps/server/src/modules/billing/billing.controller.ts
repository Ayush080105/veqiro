import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { requireOrgOwner, startTrialForOrg } from "./billing.service.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

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
