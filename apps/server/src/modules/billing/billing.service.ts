import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { NotFoundError } from "dodopayments";
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
  agentProductId,
} from "./billing.catalog.js";
import { ACCESS_STATUSES, getActiveEntitlements } from "./entitlement.service.js";
import { resumeAgentAutoPay } from "./billing.cancel.js";
import { isUniqueConstraintError } from "./billing.webhooks.js";
import type { Agent } from "../../../prisma/generated/prisma/client.js";

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

/**
 * True for Dodo's "this customer id doesn't exist" 404 specifically — not
 * any 404 (e.g. an unrelated missing product id must never trigger the
 * recovery below). Dodo customer records are per-environment: a customer id
 * created under test_mode simply does not exist against live_mode, and
 * there is no cross-environment lookup.
 */
function isCustomerNotFoundError(err: unknown): boolean {
  return err instanceof NotFoundError && /customer/i.test(err.message);
}

/**
 * REGRESSION (found 2026-08-24, live-mode cutover): every org that touched
 * billing before switching DODO_ENV from test to live has a
 * Subscription.dodoCustomerId created in the TEST environment.
 * ensureBillingCustomerForOrg reuses that id as-is once the row exists, so
 * the very first live-mode checkout/portal/topup call for that org fails
 * with an unhandled "404 Customer ... not found" from Dodo's live API — a
 * bare 500, since nothing in the checkout path expected a customer id to
 * ever go stale.
 *
 * withCustomerRecovery wraps any single Dodo call that takes a customer id:
 * on that specific error it mints a fresh customer against whichever
 * environment is CURRENTLY configured, persists it (so every later call for
 * this org is fixed for good, not just this one), and retries exactly once.
 * A second failure is not retried again — that would indicate a different,
 * genuine problem (bad API key, Dodo outage, ...) and must propagate.
 */
async function recreateBillingCustomer(organizationId: string) {
  const owner = await findOrgOwner(organizationId);
  const customer = await dodoClient.customers.create({
    email: owner.user.email,
    name: owner.user.name,
    metadata: { organizationId, type: "organization" },
  });
  return prisma.subscription.update({
    where: { organizationId },
    data: { dodoCustomerId: customer.customer_id },
  });
}

export async function withCustomerRecovery<T>(
  organizationId: string,
  customerId: string,
  fn: (customerId: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(customerId);
  } catch (err) {
    if (!isCustomerNotFoundError(err)) throw err;
    const refreshed = await recreateBillingCustomer(organizationId);
    return fn(refreshed.dodoCustomerId);
  }
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
  // later converts to a paying customer, the purchase inserts new AGENT
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
      source: { in: ["AGENT"] },
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
  source: "TRIAL" | "AGENT";
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
  const blocking = active.find(
    (e) => e.agent === agent && e.source === "AGENT" && !e.cancelAtPeriodEnd,
  );
  if (blocking) throw new ConflictError(`already-entitled:${agent}`);
}

const PENDING_CHECKOUT_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Rejects starting a second checkout for an agent while one from this org is
 * already in flight. Closes the double-purchase race: a double-click or two
 * open tabs can fire two checkout requests before either has an entitlement
 * to block on, so assertAgentPurchasable alone lets both through — the first
 * to complete provisions normally, the second mints a SECOND Dodo
 * subscription for the same agent (double charge), and a later cancel only
 * ever finds the newer of the two, leaving the other billing forever.
 *
 * A pending checkout older than PENDING_CHECKOUT_STALE_MS is treated as
 * abandoned and does not block — same staleness bound cleanupPendingCheckouts
 * uses on the webhook side.
 *
 * Pure — takes the already-fetched pending checkout row so it can be tested
 * without a database. This check alone still has a race window between the
 * read and the write; the DB-level unique constraint on
 * PendingCheckout(organizationId, agent) that createCheckoutForOrg's
 * `.create()` relies on is the actual backstop for a true concurrent race —
 * see the catch around that call.
 */
export function assertNoPendingCheckout(
  existing: { agent: Agent | null; kind: string; createdAt: Date } | null,
  agent: Agent,
  now: Date = new Date(),
): void {
  if (!existing) return;
  if (existing.kind !== "AGENT" || existing.agent !== agent) return;
  if (now.getTime() - existing.createdAt.getTime() < PENDING_CHECKOUT_STALE_MS) {
    throw new ConflictError(`checkout-already-pending:${agent}`);
  }
}

/**
 * Buys ONE agent. Dodo rejects multi-product checkouts (422 "Only one
 * subscription product allowed per checkout"), so there is no cart — buying
 * several agents is several separate checkouts, one at a time.
 */
export async function createCheckoutForOrg(
  organizationId: string,
  input: { agent?: unknown },
) {
  const sub = await ensureBillingCustomerForOrg(organizationId);
  const active = await getActiveEntitlements(organizationId);

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

  // Closes the double-purchase race (see assertNoPendingCheckout's doc
  // comment): reject, or clear if stale, an existing in-flight checkout for
  // this exact agent before minting a second Dodo checkout session.
  const existingPending = await prisma.pendingCheckout.findFirst({
    where: { organizationId, agent, kind: "AGENT" },
    orderBy: { createdAt: "desc" },
  });
  assertNoPendingCheckout(existingPending, agent);
  if (existingPending) {
    await prisma.pendingCheckout.delete({ where: { id: existingPending.id } }).catch(() => {});
  }

  const baseUrl = process.env.CLIENT_URL || "http://localhost:3001";
  const session = await withCustomerRecovery(organizationId, sub.dodoCustomerId, (customerId) =>
    dodoClient.checkoutSessions.create({
      product_cart: [{ product_id: agentProductId(agent), quantity: 1 }],
      customer: { customer_id: customerId } as never,
      // Second and later purchases reuse the card saved on the first, so only
      // the first checkout requires card entry.
      show_saved_payment_methods: true,
      return_url: `${baseUrl}/settings/billing?status=success`,
      cancel_url: `${baseUrl}/settings/billing?status=cancelled`,
      billing_currency: "USD",
      feature_flags: { allow_currency_selection: false },
      metadata: { organizationId, kind: "AGENT", agent },
    }),
  );

  if (!session.checkout_url) throw new BadRequestError("checkout-url-missing");

  try {
    await prisma.pendingCheckout.create({
      data: { organizationId, sessionId: session.session_id, kind: "AGENT", agent, plan: "MONTHLY" },
    });
  } catch (err) {
    // Backstop for a TRUE concurrent race that slipped past the check above
    // (two requests both saw no existing row, both got this far): the DB's
    // unique constraint on PendingCheckout(organizationId, agent) rejects
    // the second insert. The minted-but-orphaned Dodo checkout session from
    // this request is harmless — it simply expires unused.
    if (isUniqueConstraintError(err)) throw new ConflictError(`checkout-already-pending:${agent}`);
    throw err;
  }
  return { resumed: false as const, url: session.checkout_url };
}
