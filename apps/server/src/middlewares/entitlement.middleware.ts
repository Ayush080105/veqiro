import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { Agent } from "../../prisma/generated/prisma/client.js";
import { getActiveEntitlements } from "../modules/billing/entitlement.service.js";

/**
 * Gates /agents/* on live entitlement rows rather than the denormalized
 * Organization cache. The cache could not express per-agent expiry, and its
 * ACTIVE → entitlementExpiresAt=null encoding meant a missed webhook granted
 * access forever. Reading the rows makes expiry structural.
 */
export function entitlementMiddlewareForAgent(agent?: Agent) {
  return async function entitlementMiddleware(req: Request, res: Response, next: NextFunction) {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "No active organization" });
    }

    const active = await getActiveEntitlements(orgId);

    if (active.length === 0) {
      // Distinguish "never started" from "lapsed" so the UI can route the user
      // to the trial CTA vs the billing page. A lapsed org that has only ever
      // held TRIAL entitlements gets "Trial expired"; one that has held a
      // paid (AGENT/CREW) entitlement gets "Subscription expired". These are
      // separate frontend copy paths (see apps/main upgrade-errors.ts).
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { trialStartedAt: true },
      });

      if (!org?.trialStartedAt) {
        return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Trial not started" });
      }

      const hasHeldPaidEntitlement = await prisma.entitlement.findFirst({
        where: { organizationId: orgId, source: { in: ["AGENT", "CREW"] } },
        select: { id: true },
      });

      return res.status(StatusCodes.PAYMENT_REQUIRED).json({
        error: hasHeldPaidEntitlement ? "Subscription expired" : "Trial expired",
      });
    }

    // No specific agent (the shared /agents messages route): any entitlement passes.
    if (!agent) return next();

    const covering = active.filter((e) => e.agent === agent);
    if (covering.length === 0) {
      return res.status(StatusCodes.PAYMENT_REQUIRED).json({ error: "Agent not purchased" });
    }

    if (covering.every((e) => e.status === "PAST_DUE")) {
      // Still inside the paid period, so allow through, but let the client
      // surface a dunning banner.
      res.setHeader("X-Billing-State", "past_due");
    }

    return next();
  };
}

export const entitlementMiddleware = entitlementMiddlewareForAgent();
