import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";

export async function entitlementMiddleware(req: Request, res: Response, next: NextFunction) {
  const orgId = req.organizationId;
  if (!orgId) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "no-active-organization" });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, entitlementExpiresAt: true },
  });

  const status = org?.subscriptionStatus;
  if (!status) {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "trial-not-started" });
  }

  if (status === "ACTIVE") return next();

  if (status === "TRIALING" || status === "CANCELLED") {
    if (org!.entitlementExpiresAt && org!.entitlementExpiresAt > new Date()) return next();
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({
      error: status === "TRIALING" ? "trial-expired" : "subscription-expired",
    });
  }

  if (status === "PAST_DUE") {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "payment-failed" });
  }

  return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "subscription-expired" });
}
