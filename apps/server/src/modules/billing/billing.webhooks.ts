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

/**
 * True for Prisma's unique-constraint violation (P2002). Duck-typed on
 * `.code` rather than `instanceof Prisma.PrismaClientKnownRequestError` so
 * this also recognises the plain `{ code: "P2002" }` errors produced by
 * lightweight prisma mocks in unit tests, not just real Prisma error
 * instances — the two are otherwise indistinguishable at the call site.
 */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

type WebhookPayload = {
  type: string;
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

/**
 * Idempotency wrapper for webhook handlers.
 *
 * Uses Dodo's real event id (never a synthesized string) so a redelivery is
 * recognised as the same event regardless of timestamp.
 *
 * On handler failure the claim row is REMOVED so Dodo's retry can re-enter.
 * The previous implementation left `result: "processing"` behind, which made
 * the claim permanently reject every retry — silently losing the event.
 */
export async function withWebhookEvent<T>(
  eventId: string,
  eventType: string,
  subscriptionId: string | undefined,
  organizationId: string | null,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    await prisma.billingWebhookEvent.create({
      data: { eventId, eventType, subscriptionId, organizationId, result: "processing" },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return undefined; // already handled (or in flight) — genuine duplicate
    }
    throw err;
  }

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    // Release the claim so the provider's retry is not swallowed.
    await prisma.billingWebhookEvent
      .delete({ where: { eventId } })
      .catch((e) => console.error("[billing] failed to release webhook claim", eventId, e));
    throw err;
  }

  await prisma.billingWebhookEvent.update({
    where: { eventId },
    data: { result: String(result ?? "applied"), ...(organizationId ? { organizationId } : {}) },
  });
  return result;
}

function providerEventId(payload: WebhookPayload): string {
  // Prefer the provider's stable event id. Fall back to the business key
  // (type + subscription + period) rather than a wall-clock timestamp, so a
  // redelivery still collides with the original.
  //
  // Confirmed via node_modules/@dodopayments/core@0.3.11 dist/chunk-N4OU7BML.js:
  // handleWebhookPayload() only ever calls handler(payload) — the verified
  // `webhook-id` header (present in @dodopayments/better-auth's
  // plugins/webhooks.ts) is used for signature verification only and is
  // never forwarded to the handler. The parsed WebhookPayloadSchema envelope
  // also carries no `id`/`webhook_id` field. So this fallback is what fires
  // in practice today; the `id`/`webhook_id` checks are kept in case a
  // future SDK version starts populating them.
  const id = (payload as { id?: string; webhook_id?: string }).id
    ?? (payload as { webhook_id?: string }).webhook_id;
  if (id) return id;
  const period = payload.data.next_billing_date ?? payload.data.current_period_end ?? "no-period";
  return `${payload.type}:${payload.data.subscription_id ?? "none"}:${period}`;
}

function subscriptionMatchesCurrent(sub: BillingSub, payload: WebhookPayload) {
  const incoming = payload.data.subscription_id;
  return Boolean(incoming && sub?.dodoSubscriptionId && sub.dodoSubscriptionId === incoming);
}

export async function handleSubscriptionActive(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? findOrgIdFromPayload(payload);
  if (!orgId) return console.warn("[billing] active webhook: no org for customer", payload.data.customer?.customer_id);

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
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
      console.warn("[billing] active webhook: unresolved entitlement", {
        orgId,
        productId: payload.data.product_id,
      });
      return "ignored-unresolved-entitlement";
    }

    if (
      sub?.pendingProductId &&
      payload.data.product_id &&
      sub.pendingProductId !== payload.data.product_id
    ) {
      console.warn("[billing] active webhook: product mismatch", {
        orgId,
        productId: payload.data.product_id,
        pendingProductId: sub.pendingProductId,
      });
      return "ignored-product-mismatch";
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
    return "applied-active";
  });
}

export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
    if (!subscriptionMatchesCurrent(sub, payload)) {
      return "ignored-stale-subscription";
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
    return "applied-renewed";
  });
}

export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
    if (!subscriptionMatchesCurrent(sub, payload)) {
      return "ignored-stale-subscription";
    }
    await syncOrgEntitlement(orgId, {
      status: "CANCELLED",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: parsePeriodEnd(payload.data),
    });
    return "applied-cancelled";
  });
}

export async function handleSubscriptionExpired(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
    if (!subscriptionMatchesCurrent(sub, payload)) {
      return "ignored-stale-subscription";
    }
    await syncOrgEntitlement(orgId, { status: "EXPIRED" });
    return "applied-expired";
  });
}

export async function handleSubscriptionFailed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
    if (!subscriptionMatchesCurrent(sub, payload)) {
      return "ignored-stale-subscription";
    }
    await syncOrgEntitlement(orgId, { status: "EXPIRED" });
    return "applied-failed";
  });
}

export async function handlePaymentFailed(payload: WebhookPayload) {
  const sub = await findSubscriptionByCustomer(payload.data.customer?.customer_id);
  const orgId = sub?.organizationId ?? null;
  if (!orgId) return;

  await withWebhookEvent(providerEventId(payload), payload.type, payload.data.subscription_id, orgId, async () => {
    if (payload.data.subscription_id && !subscriptionMatchesCurrent(sub, payload)) {
      return "ignored-stale-subscription";
    }
    await syncOrgEntitlement(orgId, { status: "PAST_DUE" });
    return "applied-payment-failed";
  });
}
