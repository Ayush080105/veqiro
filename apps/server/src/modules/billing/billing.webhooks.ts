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
 *
 * IMPORTANT — this safety net only covers `fn()` throwing. The closing
 * `update()` (which records the result after `fn()` has already succeeded)
 * can *also* fail — e.g. a transient DB blip right after a successful write.
 * If that were left unhandled, the claim row would stay at `result:
 * "processing"` forever and every retry would collide on `create()` and be
 * silently swallowed: the exact defect this wrapper exists to fix, just
 * moved one step later. So that failure path is handled too, below — see
 * the comment on the second try/catch for why releasing the claim there is
 * safe only because our handlers are idempotent.
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
    // Nothing was applied yet — release the claim so the provider's retry
    // can cleanly re-enter and actually run the handler.
    await prisma.billingWebhookEvent
      .delete({ where: { eventId } })
      .catch((e) => console.error("[billing] failed to release webhook claim", eventId, e));
    throw err;
  }

  try {
    await prisma.billingWebhookEvent.update({
      where: { eventId },
      data: { result: String(result ?? "applied"), ...(organizationId ? { organizationId } : {}) },
    });
  } catch (err) {
    // By this point `fn()` has ALREADY SUCCEEDED — the business logic
    // (syncOrgEntitlement, mayaUsage.create, ...) has committed. Only the
    // ledger write recording that fact failed. We must not leave the claim
    // stuck at "processing" forever (that reproduces the original bug one
    // step later), so we delete it and rethrow — which means Dodo's retry
    // WILL re-run an already-applied handler.
    //
    // This is safe ONLY because every handler wrapped by `withWebhookEvent`
    // today is idempotent (they set a status or upsert a row), and Task 6.1
    // adds an explicit "already provisioned, ignore" guard on top. A future
    // handler that is NOT idempotent must NOT be wrapped naively like this —
    // re-running it on retry would double-apply a non-idempotent effect.
    console.error(
      "[billing] webhook ledger update failed after handler already applied; releasing claim — retry will re-run an already-applied handler",
      eventId,
      err,
    );
    await prisma.billingWebhookEvent
      .delete({ where: { eventId } })
      .catch((e) =>
        console.error("[billing] failed to release webhook claim after ledger update failure", eventId, e),
      );
    throw err;
  }
  return result;
}

/**
 * Prefer the provider's stable event id. Fall back to a business key
 * (type + subscription + period) rather than a wall-clock timestamp, so a
 * redelivery still collides with the original.
 *
 * Confirmed via node_modules/@dodopayments/core@0.3.11 dist/chunk-N4OU7BML.js:
 * handleWebhookPayload() only ever calls handler(payload) — the verified
 * `webhook-id` header (present in @dodopayments/better-auth's
 * plugins/webhooks.ts) is used for signature verification only and is
 * never forwarded to the handler. The parsed WebhookPayloadSchema envelope
 * also carries no `id`/`webhook_id` field. So the fallback below is what
 * fires in practice today; the `id`/`webhook_id` checks are kept in case a
 * future SDK version starts populating them.
 *
 * Why no timestamp in the key: an earlier version included the delivery
 * timestamp, which defeated redelivery detection entirely — every retry got
 * a fresh timestamp, so it computed a different id and reprocessed the
 * event. That was the original defect. Dropping the timestamp fixes it: a
 * redelivery of the same event carries the same type/subscription/period,
 * so it collides with the original claim and is correctly rejected.
 *
 * What this costs: the key is coarser than a real event id. Two GENUINELY
 * DISTINCT events that share type + subscription + period compute the SAME
 * key, and the second one is silently dropped without ever running — e.g.
 * two separate `payment.failed` deliveries inside one billing cycle during a
 * dunning sequence.
 *
 * Why that's tolerable TODAY: every handler wrapped with this key is
 * idempotent with respect to same-period repeats of the same type —
 * `payment.failed` twice just sets PAST_DUE twice, which is a no-op the
 * second time. `subscription.renewed` cannot collide with itself in this
 * way because renewing changes the period, and the period is part of the
 * key. So no in-scope handler currently depends on a second same-period,
 * same-type event actually running.
 *
 * WARNING for future changes: a future non-idempotent handler, or one where
 * two same-period events of the same type carry different meaning (e.g. a
 * handler that needs to count failed-payment attempts), would be silently
 * broken by this fallback — the second event just vanishes. Do not reuse
 * this key for such a handler without adding the real provider event id.
 */
export function providerEventId(payload: WebhookPayload): string {
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
