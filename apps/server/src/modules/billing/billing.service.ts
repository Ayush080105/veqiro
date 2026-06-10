import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../../lib/auth.js";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import CustomApiError from "../../common/errors/customApiError.js";
import { StatusCodes } from "http-status-codes";
import { deriveEntitlementFields, type SubscriptionLike } from "./billing.types.js";

class ForbiddenError extends CustomApiError {
  constructor(message: string) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

class ConflictError extends CustomApiError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT);
  }
}

/**
 * Resolves the active org and asserts the caller is its owner.
 * Throws on unauth, missing org, or non-owner. Returns orgId.
 */
export async function requireOrgOwner(req: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new UnauthenticatedError("Unauthorized");

  const orgId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!orgId) throw new BadRequestError("No active organization selected");

  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId: session.user.id, role: "owner" },
    select: { id: true },
  });
  if (!member) throw new ForbiddenError("only-org-owner");

  return orgId;
}

/**
 * Updates Subscription + Organization in one transaction so the denormalized
 * Org columns never drift from the Subscription row. Returns the updated
 * Subscription row.
 */
export async function syncOrgEntitlement(
  organizationId: string,
  subscriptionUpdate: Parameters<typeof prisma.subscription.update>[0]["data"],
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { organizationId },
      data: subscriptionUpdate,
    });
    const fields = deriveEntitlementFields(updated as unknown as SubscriptionLike);
    await tx.organization.update({
      where: { id: organizationId },
      data: fields,
    });
    return updated;
  });
}

/**
 * Creates the org-level Dodo customer + Subscription row + flips Organization
 * entitlement columns. One-shot: errors if a Subscription already exists.
 */
export async function startTrialForOrg(organizationId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) throw new ConflictError("trial-already-started");

  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!owner) throw new BadRequestError("Org has no owner");

  const customer = await dodoClient.customers.create({
    email: owner.user.email,
    name: owner.user.name,
    metadata: { organizationId, type: "organization" },
  });

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        organizationId,
        dodoCustomerId: customer.customer_id,
        status: "TRIALING",
        trialEndsAt,
      },
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "TRIALING", entitlementExpiresAt: trialEndsAt },
    });
    return sub;
  });
}
