import { prisma } from "../../config/prisma.js";
import { syncOrgEntitlement } from "./billing.service.js";
import { ALL_AGENTS } from "./billing.catalog.js";
import {
  parseAgentsMetadata,
  parseEntitlementModeMetadata,
  parsePlanMetadata,
  resolveEntitlementMode,
  resolvePlan,
} from "./billing.types.js";

type WebhookPayload = {
  event_id: string;
  event_type: string;
  timestamp?: string | Date;
  data: {
    customer?: { customer_id?: string };
    subscription_id?: string;
    product_id?: string;
    status?: string;
    metadata?: Record<string, string | undefined>;
    next_billing_date?: string;
    current_period_end?: string;
    cancel_at_next_billing_date?: boolean;
  };
};

type BillingSub = Awaited<ReturnType<typeof findSubscriptionByCustomer>>;

async function findSubscriptionByCustomer(customerId: string | undefined) {
  if (!customerId) return null;
  return prisma.subscription.findFirst({
    where: { dodoCustomerId: customerId },
    select: {
      organizationId: true,
      dodoSubscriptionId: true,
      pendingEntitlementMode: true,
      pendingPlan: true,
      pendingSelectedAgents: true,
      pendingProductId: true,
    },
  });
}

async function findOrgIdByCustomer(customerId: string | undefined): Promise<string | null> {
  const sub = await findSubscriptionByCustomer(customerId);
  return sub?.organizationId ?? null;
}

function findOrgIdFromPayload(payload: WebhookPayload): string | null {
  const value = payload.data.metadata?.organizationId;
  return typeof value === "string" && value ? value : null;
}

function parsePeriodEnd(p: WebhookPayload["data"]): Date | null {
  const v = p.next_billing_date ?? p.current_period_end;
  return v ? new Date(v) : null;
}

function eventId(payload: WebhookPayload) {
  return payload.event_id
    || `${payload.event_type}:${payload.data.subscription_id ?? "none"}:${payload.timestamp?.toString() ?? "no-ts"}`;
}

async function claimWebhookEvent(payload: WebhookPayload, organizationId: string | null) {
  try {
    await prisma.billingWebhookEvent.create({
      data: {
        eventId: eventId(payload),
        eventType: payload.event_type,
        subscriptionId: payload.data.subscription_id,
        organizationId,
        result: "processing",
      },
    });
    return true;
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}

async function finishWebhookEvent(payload: WebhookPayload, result: string, organizationId?: string | null) {
  await prisma.billingWebhookEvent.update({
    where: { eventId: eventId(payload) },
    data: {
      result,
      ...(organizationId ? { organizationId } : {}),
    },
  });
}

function subscriptionMatchesCurrent(sub: BillingSub, payload: WebhookPayload) {
  const incoming = payload.data.subscription_id;
  return Boolean(incoming && sub?.dodoSubscriptionId && sub.dodoSubscriptionId === incoming);
}

export async function handleSubscriptionActive(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? findOrgIdFromPayload(payload);
  if (!orgId) return console.warn("[billing] active webhook: no org for customer", payload.data.customer?.customer_id);
  if (!(await claimWebhookEvent(payload, orgId))) return;

  const plan = parsePlanMetadata(payload.data.metadata?.plan)
    ?? sub?.pendingPlan
    ?? (payload.data.product_id ? resolvePlan(payload.data.product_id) : null);
  const mode = parseEntitlementModeMetadata(payload.data.metadata?.entitlementMode)
    ?? sub?.pendingEntitlementMode
    ?? (payload.data.product_id ? resolveEntitlementMode(payload.data.product_id) : null);
  const selectedAgents = mode === "CREW"
    ? ALL_AGENTS
    : mode === "CUSTOM"
      ? parseAgentsMetadata(payload.data.metadata?.agents) ?? sub?.pendingSelectedAgents ?? null
      : null;

  if (!mode || !selectedAgents?.length) {
    await finishWebhookEvent(payload, "ignored-unresolved-entitlement", orgId);
    return console.warn("[billing] active webhook: unresolved entitlement", {
      orgId,
      productId: payload.data.product_id,
    });
  }

  if (
    sub?.pendingProductId &&
    payload.data.product_id &&
    sub.pendingProductId !== payload.data.product_id
  ) {
    await finishWebhookEvent(payload, "ignored-product-mismatch", orgId);
    return console.warn("[billing] active webhook: product mismatch", {
      orgId,
      productId: payload.data.product_id,
      pendingProductId: sub.pendingProductId,
    });
  }

  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    plan,
    entitlementMode: mode,
    selectedAgents,
    dodoSubscriptionId: payload.data.subscription_id,
    currentPeriodEnd: parsePeriodEnd(payload.data),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    pendingCheckoutSessionId: null,
    pendingPlan: null,
    pendingEntitlementMode: null,
    pendingSelectedAgents: [],
    pendingProductId: null,
    pendingCheckoutCreatedAt: null,
  });
  // Create a fresh Maya usage period for the new paid billing cycle.
  // Trial credits do not carry over — this is always a clean start.
  const activePeriodEnd = parsePeriodEnd(payload.data);
  if (activePeriodEnd) {
    await prisma.mayaUsage.create({
      data: { organizationId: orgId, periodStart: new Date(), periodEnd: activePeriodEnd },
    });
  }
  await finishWebhookEvent(payload, "applied-active", orgId);
}

export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;
  if (!(await claimWebhookEvent(payload, orgId))) return;
  if (!subscriptionMatchesCurrent(sub, payload)) {
    await finishWebhookEvent(payload, "ignored-stale-subscription", orgId);
    return;
  }
  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    currentPeriodEnd: parsePeriodEnd(payload.data),
    cancelAtPeriodEnd: false,
  });
  // Create a fresh Maya usage period for the renewed billing cycle.
  const renewedPeriodEnd = parsePeriodEnd(payload.data);
  if (renewedPeriodEnd) {
    await prisma.mayaUsage.create({
      data: { organizationId: orgId, periodStart: new Date(), periodEnd: renewedPeriodEnd },
    });
  }
  await finishWebhookEvent(payload, "applied-renewed", orgId);
}

export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;
  if (!(await claimWebhookEvent(payload, orgId))) return;
  if (!subscriptionMatchesCurrent(sub, payload)) {
    await finishWebhookEvent(payload, "ignored-stale-subscription", orgId);
    return;
  }
  await syncOrgEntitlement(orgId, {
    status: "CANCELLED",
    cancelAtPeriodEnd: true,
    currentPeriodEnd: parsePeriodEnd(payload.data),
  });
  await finishWebhookEvent(payload, "applied-cancelled", orgId);
}

export async function handleSubscriptionExpired(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;
  if (!(await claimWebhookEvent(payload, orgId))) return;
  if (!subscriptionMatchesCurrent(sub, payload)) {
    await finishWebhookEvent(payload, "ignored-stale-subscription", orgId);
    return;
  }
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
  await finishWebhookEvent(payload, "applied-expired", orgId);
}

export async function handleSubscriptionFailed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;
  if (!(await claimWebhookEvent(payload, orgId))) return;
  if (!subscriptionMatchesCurrent(sub, payload)) {
    await finishWebhookEvent(payload, "ignored-stale-subscription", orgId);
    return;
  }
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
  await finishWebhookEvent(payload, "applied-failed", orgId);
}

export async function handlePaymentFailed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;
  if (!(await claimWebhookEvent(payload, orgId))) return;
  if (payload.data.subscription_id && !subscriptionMatchesCurrent(sub, payload)) {
    await finishWebhookEvent(payload, "ignored-stale-subscription", orgId);
    return;
  }
  await syncOrgEntitlement(orgId, { status: "PAST_DUE" });
  await finishWebhookEvent(payload, "applied-payment-failed", orgId);
}
