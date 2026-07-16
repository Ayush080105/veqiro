import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import auth from "../../lib/auth.js";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import CustomApiError from "../../common/errors/customApiError.js";
import { StatusCodes } from "http-status-codes";
import {
  ALL_AGENTS,
  normalizeAgents,
  normalizePlan,
  agentProductId,
  crewProductId,
} from "./billing.catalog.js";
import { ACCESS_STATUSES, getActiveEntitlements } from "./entitlement.service.js";
import { resumeAgentAutoPay } from "./billing.cancel.js";
import { quoteCrewUpgrade, type UpgradeQuote } from "./billing.upgrade.js";
import type { Agent, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";

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

async function findOrgOwner(organizationId: string) {
  const owner = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!owner) throw new BadRequestError("Org has no owner");
  return owner;
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

type ActiveEntitlement = {
  agent: Agent;
  source: "TRIAL" | "AGENT" | "CREW";
  cancelAtPeriodEnd: boolean;
};

/**
 * Rejects purchases that would double-charge. Pure — takes the already-fetched
 * active entitlements so it can be tested without a database.
 *
 * A TRIAL row does not block purchase (that is the conversion path), and an
 * AGENT row with cancelAtPeriodEnd does not block either — repurchasing is how
 * the user resumes auto-pay, handled charge-free in createCheckoutForOrg.
 */
export function assertAgentPurchasable(active: ActiveEntitlement[], agent: Agent): void {
  if (active.some((e) => e.source === "CREW")) {
    throw new ConflictError("crew-covers-all-agents");
  }
  const blocking = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && !e.cancelAtPeriodEnd,
  );
  if (blocking) throw new ConflictError(`already-entitled:${agent}`);
}

/**
 * Pure core shared by getUpgradeQuoteForOrg and createCrewCheckout: prices a
 * Crew upgrade from already-fetched active entitlements, so the checkout
 * path doesn't need a second DB round trip to re-derive the same quote.
 *
 * An active CREW row short-circuits to "already-on-crew" before
 * quoteCrewUpgrade is even called — that function only sees AGENT prices, so
 * it has no way to know the org already holds a Crew entitlement.
 *
 * Credit uses each row's stored priceCents (what was actually paid), never
 * today's list price, so a catalog price change cannot retroactively move an
 * existing customer's credit. Only source: "AGENT" rows count — TRIAL and
 * CREW rows are excluded from the sum.
 */
function quoteUpgradeFromActive(
  active: Array<{ source: string; priceCents: number }>,
  plan: SubscriptionPlan,
): UpgradeQuote {
  if (active.some((e) => e.source === "CREW")) {
    return { eligible: false, creditCents: 0, reason: "already-on-crew" };
  }
  const owned = active.filter((e) => e.source === "AGENT").map((e) => e.priceCents);
  return quoteCrewUpgrade(owned, plan);
}

/**
 * Prices a Crew upgrade from the org's live entitlements. Read-only — this
 * is what the settings page polls to show "Upgrade to Crew for $X" before
 * the user commits to a checkout.
 */
export async function getUpgradeQuoteForOrg(
  organizationId: string,
  plan: SubscriptionPlan,
): Promise<UpgradeQuote> {
  const active = await getActiveEntitlements(organizationId);
  return quoteUpgradeFromActive(active, plan);
}

/**
 * Crew checkout, with a credited upgrade for orgs that already own
 * individual agents. Dodo supports percentage discounts only
 * (UNSUPPORTED_DISCOUNT_TYPE for flat amounts), so the credit is expressed
 * as basis points of the Crew price and applied with subscription_cycles: 1
 * so only the first billing cycle is discounted — renewals bill full price
 * with no action from us.
 *
 * Ineligible is NOT the same as blocked: an org with no credit (or one whose
 * credit would exceed the Crew price) can still buy Crew at full price, they
 * just get no discount. The one case that IS blocked is already owning
 * Crew — buying it twice is nonsense, so that throws instead of silently
 * charging full price again.
 *
 * If discount creation fails, we deliberately do not fail the whole
 * checkout: a user who cannot get their credit applied should still be able
 * to buy Crew. We log and fall through to an undiscounted checkout instead
 * of blocking the purchase.
 */
async function createCrewCheckout(
  organizationId: string,
  sub: Awaited<ReturnType<typeof ensureBillingCustomerForOrg>>,
  active: Awaited<ReturnType<typeof getActiveEntitlements>>,
  plan: SubscriptionPlan,
) {
  const quote = quoteUpgradeFromActive(active, plan);
  if (!quote.eligible && quote.reason === "already-on-crew") {
    throw new ConflictError("already-on-crew");
  }

  let discountCode: string | undefined;
  // Surfaced to the frontend so it can warn the customer rather than let
  // them discover a missing discount only after being charged full price —
  // see createCheckoutForOrg's return type and CrewUpgradeCard.tsx's usage.
  let discountApplied: "applied" | "failed" | "not-eligible" = "not-eligible";
  if (quote.eligible) {
    try {
      const discount = await dodoClient.discounts.create({
        type: "percentage",
        amount: quote.discountBasisPoints,
        name: `Crew upgrade credit — org ${organizationId}`,
        usage_limit: 1,
        subscription_cycles: 1,
        restricted_to: [crewProductId(plan)],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      discountCode = discount.code;
      discountApplied = "applied";
    } catch (err) {
      // Do not fail the purchase over a missed discount — log and continue
      // to an undiscounted Crew checkout below.
      console.error("crew-upgrade-discount-create-failed", { organizationId, err });
      discountApplied = "failed";
    }
  }

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await dodoClient.checkoutSessions.create({
    product_cart: [{ product_id: crewProductId(plan), quantity: 1 }],
    customer: { customer_id: sub.dodoCustomerId } as never,
    return_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
    // Our catalog is USD-only — lock the checkout page's displayed currency
    // to USD instead of letting Dodo auto-convert to the buyer's local
    // currency, so the number shown always matches what the app quoted.
    billing_currency: "USD",
    feature_flags: { allow_currency_selection: false },
    ...(discountCode ? { discount_code: discountCode } : {}),
    metadata: {
      organizationId,
      kind: discountCode ? "CREW_UPGRADE" : "CREW",
      plan,
    },
  });

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.pendingCheckout.create({
    data: {
      organizationId,
      sessionId: session.session_id,
      // Reflects what actually happened, not what was merely eligible: if
      // the discount call above failed, this fell through to a plain Crew
      // checkout, so it is recorded as CREW rather than CREW_UPGRADE.
      kind: discountCode ? "CREW_UPGRADE" : "CREW",
      plan,
      discountCode,
    },
  });
  return { resumed: false as const, url: session.checkout_url, discountApplied };
}

/**
 * Buys ONE agent. Dodo rejects multi-product checkouts (422 "Only one
 * subscription product allowed per checkout"), so there is no cart — buying
 * several agents is several separate checkouts, one at a time.
 */
export async function createCheckoutForOrg(
  organizationId: string,
  input: { agent?: unknown; cadence?: unknown; crew?: boolean },
) {
  const sub = await ensureBillingCustomerForOrg(organizationId);
  const active = await getActiveEntitlements(organizationId);

  if (input.crew) {
    return createCrewCheckout(organizationId, sub, active, normalizePlan(input.cadence));
  }

  // normalizeAgents gives slug ("rex") and enum ("REX") handling plus
  // validation for free; we just require exactly one.
  const agent = normalizeAgents([input.agent])[0];
  if (!agent) throw new BadRequestError("agent-required");

  // Resuming a cancelled-but-unexpired agent must NOT create a second
  // subscription — the user already has one, it is merely flagged to stop.
  // This runs BEFORE assertAgentPurchasable: the guard deliberately lets a
  // cancelled-but-unexpired agent through so it can be re-enabled, but
  // sending them to Dodo would mint a second subscription and double-charge.
  const resumable = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && e.cancelAtPeriodEnd,
  );
  if (resumable) {
    await resumeAgentAutoPay(organizationId, agent);
    return { resumed: true as const, url: null };
  }

  assertAgentPurchasable(active, agent);

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await dodoClient.checkoutSessions.create({
    product_cart: [{ product_id: agentProductId(agent), quantity: 1 }],
    customer: { customer_id: sub.dodoCustomerId } as never,
    // Second and later purchases reuse the card saved on the first, so only
    // the first checkout requires card entry.
    show_saved_payment_methods: true,
    return_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
    billing_currency: "USD",
    feature_flags: { allow_currency_selection: false },
    metadata: { organizationId, kind: "AGENT", agent },
  });

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");
  await prisma.pendingCheckout.create({
    data: { organizationId, sessionId: session.session_id, kind: "AGENT", agent, plan: "MONTHLY" },
  });
  return { resumed: false as const, url: session.checkout_url };
}
