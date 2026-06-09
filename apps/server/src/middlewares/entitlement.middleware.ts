import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";

export async function entitlementMiddleware(req: Request, res: Response, next: NextFunction) {
  const orgId = req.organizationId;
  if (!orgId) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "No active organization" });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, entitlementExpiresAt: true },
  });

  const status = org?.subscriptionStatus;
  if (!status) {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Trial not started" });
  }

  if (status === "ACTIVE") return next();

  if (status === "TRIALING" || status === "CANCELLED") {
    if (org!.entitlementExpiresAt && org!.entitlementExpiresAt > new Date()) return next();
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({
      error: status === "TRIALING" ? "Trial expired" : "Subscription expired",
    });
  }

  if (status === "PAST_DUE") {
    return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Payment failed" });
  }

  return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Subscription expired" });
}
