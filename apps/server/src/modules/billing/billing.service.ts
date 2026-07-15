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
  isCrewSelection,
  normalizeAgents,
  normalizePlan,
  sumAgentMonthlyPriceCents,
} from "./billing.catalog.js";
import { ACCESS_STATUSES } from "./entitlement.service.js";
import type { Prisma } from "../../../prisma/generated/prisma/client.js";

type TxClient = Prisma.TransactionClient;

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
 *
 * Pass an existing transaction client as `tx` to fold this into a larger
 * atomic operation. When `tx` is omitted, this opens and commits its own
 * transaction as before — existing callers (billing.webhooks.ts) are
 * unaffected.
 */
export async function syncOrgEntitlement(
  organizationId: string,
  subscriptionUpdate: Parameters<typeof prisma.subscription.update>[0]["data"],
  tx?: TxClient,
) {
  const run = async (client: TxClient | typeof prisma) => {
    const updated = await client.subscription.update({
      where: { organizationId },
      data: subscriptionUpdate,
    });
    const fields = deriveEntitlementFields(updated as unknown as SubscriptionLike);
    await client.organization.update({
      where: { id: organizationId },
      data: fields,
    });
    return updated;
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
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

const TRIAL_DAYS = 7;

/**
 * Starts the org's one-and-only trial: all six agents, 7 days, no card.
 *
 * There is deliberately NO agent selection — the trial is all-or-nothing — and
 * it is once-per-org FOREVER (guarded by trialStartedAt, not by whether a trial
 * is currently running). Per-agent or repeatable trials would be farmable into
 * ~6 weeks of free access by staggering agents, with Maya's 30 credits the
 * obvious target and orgs free to create.
 */
export async function startTrialForOrg(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { trialStartedAt: true },
  });
  if (!org) throw new BadRequestError("no-organization");
  if (org.trialStartedAt) throw new ConflictError("trial-already-used");

  // Ensure the Dodo customer exists now so later checkout has one to attach to.
  await ensureBillingCustomerForOrg(organizationId);

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.entitlement.createMany({
      data: ALL_AGENTS.map((agent) => ({
        organizationId,
        agent,
        source: "TRIAL" as const,
        status: "TRIALING" as const,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        priceCents: 0,
      })),
    });
    await tx.organization.update({
      where: { id: organizationId },
      data: { trialStartedAt: now },
    });
    await tx.mayaUsage.create({
      data: { organizationId, periodStart: now, periodEnd: trialEndsAt },
    });
  });

  return { trialEndsAt, agents: ALL_AGENTS };
}

/**
 * Admin action: push an org's trial out by `days` from now.
 *
 * Intentionally re-TRIALs rows the sweeper may already have marked EXPIRED —
 * that is what "extend an expired trial" means. Does NOT touch
 * MayaUsage.creditsUsed: extending an expired trial must not silently hand
 * back credits already spent (preserving the behavior previously documented
 * on the deleted `startOrExtendTrial`).
 */
export async function extendTrialForOrg(organizationId: string, days = 7) {
  const now = new Date();

  // Guard against reviving a paying customer's trial. A TRIAL row does NOT
  // expire out of existence: when the trial period lapses the sweeper flips
  // the six TRIAL rows to EXPIRED, but they are never deleted. When that org
  // later converts to a paying customer, the purchase inserts new AGENT/CREW
  // rows alongside the old ones rather than replacing them. So "the org has
  // TRIAL rows" — even stale EXPIRED ones — is never evidence the org is
  // currently a trial org; it only proves they trialed at some point in the
  // past. Without this check, updateMany's unfiltered `source: "TRIAL"`
  // where-clause would happily flip those stale EXPIRED rows back to
  // TRIALING with a fresh period, handing a paying customer free access to
  // agents they never bought. We key on *currently active* paid access
  // (status in ACCESS_STATUSES AND currentPeriodEnd in the future) rather
  // than "ever had a paid entitlement", so a lapsed ex-customer's trial can
  // still be legitimately revived by an admin.
  const activePaidEntitlement = await prisma.entitlement.findFirst({
    where: {
      organizationId,
      source: { in: ["AGENT", "CREW"] },
      status: { in: ACCESS_STATUSES },
      currentPeriodEnd: { gt: now },
    },
    select: { id: true },
  });
  if (activePaidEntitlement) throw new BadRequestError("org-has-paid-entitlement");

  const trialEndsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.entitlement.updateMany({
    where: { organizationId, source: "TRIAL" },
    data: { status: "TRIALING", currentPeriodEnd: trialEndsAt },
  });
  if (count === 0) throw new BadRequestError("no-trial-to-extend");
  return { trialEndsAt };
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
    ? sumAgentMonthlyPriceCents(selectedAgents)
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
