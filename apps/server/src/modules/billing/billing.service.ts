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
import type { Agent, Prisma } from "../../../prisma/generated/prisma/client.js";

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
 * atomic operation (e.g. `startOrExtendTrial`'s existing-subscription branch,
 * which also needs to touch MayaUsage in the same transaction). When `tx` is
 * omitted, this opens and commits its own transaction as before — existing
 * callers (billing.webhooks.ts) are unaffected.
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

/**
 * Shared "no Subscription yet -> create one in TRIALING state" core. Creates
 * the Dodo customer, the Subscription row, flips the Organization cache
 * fields, and opens the initial MayaUsage period, all in one transaction
 * (the Dodo customer create is an external API call so it happens first).
 *
 * Used by both `startTrialForOrg` (owner-initiated, agent selection comes
 * from the request) and `startOrExtendTrial` (admin/migration-initiated, no
 * request context) so there is exactly one implementation of this branch.
 */
async function createTrialSubscription(
  organizationId: string,
  days: number,
  selectedAgents: Agent[],
  entitlementMode: "CREW" | "CUSTOM",
) {
  const owner = await findOrgOwner(organizationId);
  const customer = await dodoClient.customers.create({
    email: owner.user.email,
    name: owner.user.name,
    metadata: { organizationId, type: "organization" },
  });

  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

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

/**
 * Creates the org-level Dodo customer + Subscription row + flips Organization
 * entitlement columns. One-shot: errors if a Subscription already exists.
 */
export async function startTrialForOrg(organizationId: string, inputAgents?: unknown) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  if (existing) throw new ConflictError("trial-already-started");

  const selectedAgents = inputAgents === undefined ? ALL_AGENTS : normalizeAgents(inputAgents);
  if (selectedAgents.length === 0) throw new BadRequestError("select-at-least-one-agent");
  const entitlementMode = isCrewSelection(selectedAgents) ? "CREW" : "CUSTOM";

  return createTrialSubscription(organizationId, 7, selectedAgents, entitlementMode);
}

/**
 * Gives an org a trial without requiring owner-authenticated request context
 * — callable from admin actions (`extendTrial`) and the legacy-org migration
 * script. Fixes the drift bug where those callers used to only patch the
 * denormalized `Organization` cache: this always keeps `Subscription` (the
 * source of truth) and `Organization` in sync, and creates either if missing.
 *
 * - No Subscription row yet: creates one from scratch via
 *   `createTrialSubscription`, same shape as `startTrialForOrg`, defaulting
 *   to full CREW access since there's no owner-supplied agent selection in
 *   this context.
 * - Subscription row exists: in a single transaction, updates status/
 *   trialEndsAt on Subscription + Organization together via
 *   `syncOrgEntitlement` (so `deriveEntitlementFields` stays the single
 *   source of truth for the cache, preserving whatever entitlementMode/
 *   selectedAgents the org already had), then extends the org's most recent
 *   MayaUsage period's `periodEnd` to match the new `trialEndsAt` — even if
 *   that period already lapsed, so `creditsUsed` is always preserved rather
 *   than reset — or creates a fresh period only if the org has no MayaUsage
 *   row at all yet. All three writes (Subscription, Organization, MayaUsage)
 *   commit or roll back together — never left half-applied.
 */
export async function startOrExtendTrial(organizationId: string, days = 7) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });

  if (!existing) {
    return createTrialSubscription(organizationId, days, ALL_AGENTS, "CREW");
  }

  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const updated = await syncOrgEntitlement(organizationId, { status: "TRIALING", trialEndsAt }, tx);

    // Always reuse the org's most recent usage period when one exists — even
    // if its periodEnd has already lapsed — so extending an *expired* trial
    // preserves whatever credits were already spent instead of silently
    // resetting creditsUsed to 0 via a fresh row (which would hand back
    // "free" credits an admin never intended to grant). Only create a
    // brand-new period when the org genuinely has no MayaUsage row yet.
    const latestPeriod = await tx.mayaUsage.findFirst({
      where: { organizationId },
      orderBy: { periodStart: "desc" },
    });

    if (latestPeriod) {
      // Push the period's end out to match the new trialEndsAt instead of
      // leaving it pointing at the old window (which would otherwise make
      // usage checks fail with "no-active-usage-period" before the
      // (now-later) trial actually ends).
      await tx.mayaUsage.update({
        where: {
          organizationId_periodStart: {
            organizationId,
            periodStart: latestPeriod.periodStart,
          },
        },
        data: { periodEnd: trialEndsAt },
      });
    } else {
      await tx.mayaUsage.create({
        data: {
          organizationId,
          periodStart: new Date(),
          periodEnd: trialEndsAt,
        },
      });
    }

    return updated;
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
