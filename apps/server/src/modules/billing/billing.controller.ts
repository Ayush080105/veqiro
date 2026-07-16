import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import {
  createCheckoutForOrg,
  getUpgradeQuoteForOrg,
  requireOrgOwner,
  startTrialForOrg,
} from "./billing.service.js";
import { cancelAgentAutoPay, resumeAgentAutoPay } from "./billing.cancel.js";
import { cancelCrewAutoPay, resumeCrewAutoPay } from "./billing.crew-cancel.js";
import { createMayaTopupCheckout } from "./billing.topup.js";
import { normalizeAgents, normalizePlan } from "./billing.catalog.js";
import { getActiveEntitlements } from "./entitlement.service.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import type { Agent, EntitlementSource, EntitlementStatus } from "../../../prisma/generated/prisma/client.js";

function daysRemaining(date: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

type ActiveEntitlementLike = {
  agent: Agent;
  source: EntitlementSource;
  status: EntitlementStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  priceCents: number;
};

/**
 * Pure core of getStatus's legacy-field derivation, split out so it can be
 * unit tested without a database.
 *
 * `Subscription.status` can never be TRIALING for a new trial any more —
 * trial state lives on Entitlement rows now (source: "TRIAL") — so
 * trialEndsAt/daysRemaining must come from those rows, not the Subscription
 * row, or the UI is stuck showing "Trial · 0 days left" forever.
 */
export function deriveStatusFields(active: ActiveEntitlementLike[]) {
  const agents = [...new Set(active.map((e) => e.agent))];
  const isCrew = active.some((e) => e.source === "CREW");
  const trialRows = active.filter((e) => e.source === "TRIAL");
  const trialEndsAt = trialRows.length
    ? new Date(Math.max(...trialRows.map((e) => e.currentPeriodEnd.getTime())))
    : null;

  return {
    entitlementMode: (isCrew ? "CREW" : "CUSTOM") as "CREW" | "CUSTOM",
    unlockedAgents: agents,
    selectedAgents: agents,
    currentPeriodEnd: active.length
      ? new Date(Math.max(...active.map((e) => e.currentPeriodEnd.getTime())))
      : null,
    trialEndsAt,
    daysRemaining: daysRemaining(trialEndsAt),
    entitlements: active.map((e) => ({
      agent: e.agent,
      source: e.source,
      status: e.status,
      currentPeriodEnd: e.currentPeriodEnd,
      cancelAtPeriodEnd: e.cancelAtPeriodEnd,
      priceCents: e.priceCents,
    })),
  };
}

export async function getStatus(req: Request, res: Response) {
  const organizationId = req.organizationId;
  if (!organizationId) throw new BadRequestError("No active organization selected");

  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      status: true,
      plan: true,
      dodoCustomerId: true,
    },
  });

  if (!sub) {
    res.status(StatusCodes.OK).json({ subscription: null });
    return;
  }

  const active = await getActiveEntitlements(organizationId);
  const derived = deriveStatusFields(active);

  // Checkout creation writes a PendingCheckout row (not the legacy
  // Subscription.pending* columns, which nothing writes anymore); the
  // matching row is deleted once its webhook resolves, so "most recent row
  // for this org" is exactly "is a checkout still in flight."
  const pending = await prisma.pendingCheckout.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { kind: true, agent: true, plan: true, createdAt: true },
  });

  res.status(StatusCodes.OK).json({
    subscription: {
      status: sub.status,
      plan: sub.plan,
      trialEndsAt: derived.trialEndsAt,
      currentPeriodEnd: derived.currentPeriodEnd,
      dodoCustomerId: sub.dodoCustomerId,
      entitlementMode: derived.entitlementMode,
      selectedAgents: derived.selectedAgents,
      unlockedAgents: derived.unlockedAgents,
      pendingCheckout: pending
        ? { kind: pending.kind, agent: pending.agent, plan: pending.plan, createdAt: pending.createdAt }
        : null,
      daysRemaining: derived.daysRemaining,
      entitlements: derived.entitlements,
    },
  });
}

// The `agents` body param is gone; trials are all-or-nothing.
export async function startTrial(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const result = await startTrialForOrg(orgId);
  res.status(StatusCodes.CREATED).json({
    status: "TRIALING",
    trialEndsAt: result.trialEndsAt,
    agents: result.agents,
  });
}

export async function createCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const checkout = await createCheckoutForOrg(orgId, {
    agent: req.body?.agent,
    cadence: req.body?.cadence,
    crew: req.body?.crew,
  });
  res.status(StatusCodes.OK).json(checkout);
}

// Read-only pricing lookup — no owner check, any authenticated org member
// may see what a Crew upgrade would cost.
export async function getUpgradeQuote(req: Request, res: Response) {
  const organizationId = req.organizationId;
  if (!organizationId) throw new BadRequestError("No active organization selected");
  const plan = normalizePlan(req.query.cadence ?? "MONTHLY");
  res.status(StatusCodes.OK).json(await getUpgradeQuoteForOrg(organizationId, plan));
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

// Billing changes are owner-only — both routes go through requireOrgOwner.
export async function cancelAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await cancelAgentAutoPay(orgId, agent));
}

export async function resumeAgent(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const [agent] = normalizeAgents([req.params.agent]);
  res.status(StatusCodes.OK).json(await resumeAgentAutoPay(orgId, agent));
}

export async function cancelCrew(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  res.status(StatusCodes.OK).json(await cancelCrewAutoPay(orgId));
}

export async function resumeCrew(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  res.status(StatusCodes.OK).json(await resumeCrewAutoPay(orgId));
}

// Owner-gated like every other checkout-initiating route (createCheckout,
// crew checkout) — this starts a real charge, unlike merely spending
// already-purchased Maya credits, which any org member may do.
export async function startMayaTopupCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  res.status(StatusCodes.OK).json(await createMayaTopupCheckout(orgId, req.body?.dollars));
}

// Clears the org's "Checkout syncing" UI state for a stuck/abandoned
// checkout. Deliberately narrow: this only removes PendingCheckout row(s) —
// it must never touch entitlements. If the webhook for this exact checkout
// arrives later anyway, provisioning is unaffected: applyAgentActivation /
// applyCrewActivation / handleMayaTopupPaymentSucceeded all key off the Dodo
// subscription/payment id and webhook idempotency ledger, not off this row
// still existing — cleanupPendingCheckouts' matching is best-effort cleanup,
// not a provisioning precondition.
export async function dismissPendingCheckout(req: Request, res: Response) {
  const orgId = await requireOrgOwner(req);
  const { count } = await prisma.pendingCheckout.deleteMany({ where: { organizationId: orgId } });
  res.status(StatusCodes.OK).json({ dismissed: count });
}
