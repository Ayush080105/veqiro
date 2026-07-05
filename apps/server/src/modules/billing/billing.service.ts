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
import {
  ALL_AGENTS,
  calculateAgentSelectionPriceCents,
  isCrewSelection,
  normalizeAgents,
  normalizePlan,
} from "./billing.catalog.js";

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

const ACTIVE_BILLING_STATUSES = new Set(["ACTIVE", "PAST_DUE", "CANCELLED"]);

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

async function findOrgOwner(organizationId: string) {
  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!owner) throw new BadRequestError("Org has no owner");
  return owner;
}

function customProductEnvKey(plan: "MONTHLY" | "ANNUAL") {
  return plan === "ANNUAL" ? "DODO_CUSTOM_ANNUAL_PRODUCT_ID" : "DODO_CUSTOM_MONTHLY_PRODUCT_ID";
}

function checkoutProductId(entitlementMode: "CREW" | "CUSTOM", plan: "MONTHLY" | "ANNUAL") {
  if (entitlementMode === "CREW") {
    return plan === "ANNUAL"
      ? process.env.DODO_PRO_ANNUAL_PRODUCT_ID
      : process.env.DODO_PRO_MONTHLY_PRODUCT_ID;
  }

  return process.env[customProductEnvKey(plan)];
}

export async function ensureBillingCustomerForOrg(organizationId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;

  const owner = await findOrgOwner(organizationId);
  const customer = await dodoClient.customers.create({
    email: owner.user.email,
    name: owner.user.name,
    metadata: { organizationId, type: "organization" },
  });

  return prisma.subscription.create({
    data: {
      organizationId,
      dodoCustomerId: customer.customer_id,
      status: "EXPIRED",
      entitlementMode: "CUSTOM",
      selectedAgents: [],
    },
  });
}

/**
 * Creates the org-level Dodo customer + Subscription row + flips Organization
 * entitlement columns. One-shot: errors if a Subscription already exists.
 */
export async function startTrialForOrg(organizationId: string, inputAgents?: unknown) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) throw new ConflictError("trial-already-started");

  const owner = await findOrgOwner(organizationId);
  const selectedAgents = inputAgents === undefined ? ALL_AGENTS : normalizeAgents(inputAgents);
  if (selectedAgents.length === 0) throw new BadRequestError("select-at-least-one-agent");
  const entitlementMode = isCrewSelection(selectedAgents) ? "CREW" : "CUSTOM";

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
        entitlementMode,
        selectedAgents,
      },
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: "TRIALING",
        entitlementExpiresAt: trialEndsAt,
        unlockedAgents: selectedAgents,
      },
    });
    // Create the trial usage period for Maya; starts now, ends when trial expires.
    await tx.mayaUsage.create({
      data: {
        organizationId,
        periodStart: new Date(),
        periodEnd: trialEndsAt,
      },
    });
    return sub;
  });
}

export async function createCheckoutForOrg(
  organizationId: string,
  input: { agents?: unknown; cadence?: unknown },
) {
  const selectedAgents = normalizeAgents(input.agents);
  if (selectedAgents.length === 0) throw new BadRequestError("select-at-least-one-agent");

  const plan = normalizePlan(input.cadence);
  const entitlementMode = isCrewSelection(selectedAgents) ? "CREW" : "CUSTOM";
  if (entitlementMode === "CUSTOM" && plan !== "MONTHLY") {
    throw new BadRequestError("custom-agents-monthly-only");
  }
  const sub = await ensureBillingCustomerForOrg(organizationId);
  if (sub.dodoSubscriptionId && ACTIVE_BILLING_STATUSES.has(sub.status)) {
    throw new ConflictError("manage-existing-subscription-in-portal");
  }
  const productId = checkoutProductId(entitlementMode, plan);

  if (!productId) {
    throw new BadRequestError(
      entitlementMode === "CUSTOM"
        ? `missing-${customProductEnvKey(plan).toLowerCase()}`
        : "missing-dodo-product-id",
    );
  }

  const customPriceCents = entitlementMode === "CUSTOM"
    ? calculateAgentSelectionPriceCents(selectedAgents, plan)
    : null;
  const quantity = customPriceCents == null ? 1 : customPriceCents / 100;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BadRequestError("custom-agent-price-must-be-whole-dollar");
  }

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await dodoClient.checkoutSessions.create({
    product_cart: [
      {
        product_id: productId,
        quantity,
      },
    ],
    customer: { customer_id: sub.dodoCustomerId } as never,
    return_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
    metadata: {
      organizationId,
      entitlementMode,
      plan,
      agents: selectedAgents.join(","),
    },
  });

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      pendingCheckoutSessionId: session.session_id,
      pendingPlan: plan,
      pendingEntitlementMode: entitlementMode,
      pendingSelectedAgents: selectedAgents,
      pendingProductId: productId,
      pendingCheckoutCreatedAt: new Date(),
    },
  });
  return { url: session.checkout_url };
}
