import { prisma } from "../../config/prisma.js";
import {
  ALL_AGENTS,
  getAgentMonthlyPriceCents,
  resolveAgentFromProductId,
} from "./billing.catalog.js";
import { grantPurchasedTopupCredits } from "../agents/maya/maya.usage.service.js";
import { TOPUP_CREDITS_PER_UNIT } from "../agents/maya/maya.quotas.js";
import type { Agent, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";

/**
 * True for Prisma's unique-constraint violation (P2002). Duck-typed on
 * `.code` rather than `instanceof Prisma.PrismaClientKnownRequestError` so
 * this also recognises the plain `{ code: "P2002" }` errors produced by
 * lightweight prisma mocks in unit tests, not just real Prisma error
 * instances — the two are otherwise indistinguishable at the call site.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

type WebhookPayload = {
  type: string;
  timestamp?: string | Date;
  data: {
    customer?: { customer_id?: string };
    subscription_id?: string;
    product_id?: string;
    payment_id?: string;
    product_cart?: { product_id: string; quantity: number }[] | null;
    status?: string;
    metadata?: Record<string, string | undefined>;
    next_billing_date?: string;
    current_period_end?: string;
    cancel_at_next_billing_date?: boolean;
  };
};

async function findSubscriptionByCustomer(customerId: string | undefined) {
  if (!customerId) return null;
  return prisma.subscription.findFirst({
    where: { dodoCustomerId: customerId },
    select: { organizationId: true },
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

/**
 * Resolves the owning org for a known Dodo subscription, purely so the
 * BillingWebhookEvent ledger row can be tagged with it. This is a read-only
 * lookup done BEFORE the idempotency claim (withWebhookEvent's `create`), so
 * it's safe to run on every delivery including redeliveries — it has no
 * side effect of its own. Returns null for an unknown subscription (the
 * handler itself logs/returns "ignored-unknown-subscription"; the ledger row
 * for that event is simply left unattributed, same as before).
 */
async function resolveOrgIdForSubscription(dodoSubId: string): Promise<string | null> {
  const bs = await prisma.billingSubscription.findUnique({
    where: { dodoSubscriptionId: dodoSubId },
    select: { organizationId: true },
  });
  return bs?.organizationId ?? null;
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
    // (applyAgentActivation, ...) has committed. Only
    // the ledger write recording that fact failed. We must not leave the
    // claim stuck at "processing" forever (that reproduces the original bug
    // one step later), so we delete it and rethrow — which means Dodo's
    // retry WILL re-run an already-applied handler.
    //
    // This is safe ONLY because every handler wrapped by `withWebhookEvent`
    // today is idempotent (they set a status, upsert a row, or — for
    // handleSubscriptionActive — check for an existing BillingSubscription
    // before creating one). A future handler that is NOT idempotent must NOT
    // be wrapped naively like this — re-running it on retry would
    // double-apply a non-idempotent effect.
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
 *
 * One-time payments (e.g. a Maya credit top-up) have no subscription_id and
 * no period fields at all — every one of them would otherwise collapse onto
 * the identical key `payment.succeeded:none:no-period`, silently dropping
 * the second and every subsequent top-up as a "duplicate". Dodo's payment_id
 * is a stable per-payment identifier always present on `payment.*` events,
 * so it is checked BEFORE falling through to the subscription/period key.
 */
export function providerEventId(payload: WebhookPayload): string {
  const id = (payload as { id?: string; webhook_id?: string }).id
    ?? (payload as { webhook_id?: string }).webhook_id;
  if (id) return id;
  if (payload.data.payment_id) return `${payload.type}:payment:${payload.data.payment_id}`;
  const period = payload.data.next_billing_date ?? payload.data.current_period_end ?? "no-period";
  return `${payload.type}:${payload.data.subscription_id ?? "none"}:${period}`;
}

type CheckoutKind = "AGENT" | "MAYA_TOPUP";

function isCheckoutKind(value: unknown): value is CheckoutKind {
  return value === "AGENT" || value === "MAYA_TOPUP";
}

function isAgentValue(value: unknown): value is Agent {
  return typeof value === "string" && (ALL_AGENTS as string[]).includes(value);
}

/**
 * Provisions the entitlement for a newly-activated single-agent subscription.
 *
 * Crucially this only ADDS a row for THIS agent. The old handler wrote
 * Subscription.selectedAgents wholesale, so a second purchase erased the
 * first (defect 2 — buying Rex erased Maya).
 *
 * One agent per subscription is a platform constraint, not a choice: Dodo
 * rejects multi-subscription-product carts (422 "Only one subscription
 * product allowed per checkout", verified), so `agent` is always singular
 * here — never an array.
 */
export async function applyAgentActivation(input: {
  organizationId: string;
  dodoSubscriptionId: string;
  agent: Agent;
  periodEnd: Date;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const bs = await tx.billingSubscription.create({
      data: {
        organizationId: input.organizationId,
        dodoSubscriptionId: input.dodoSubscriptionId,
        plan: "MONTHLY", // individual agents are MONTHLY-only by design
        status: "ACTIVE",
        currentPeriodEnd: input.periodEnd,
      },
    });
    await tx.entitlement.create({
      data: {
        organizationId: input.organizationId,
        agent: input.agent,
        source: "AGENT",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: input.periodEnd,
        priceCents: getAgentMonthlyPriceCents(input.agent),
        billingSubscriptionId: bs.id,
      },
    });
    return bs;
  });
}

/**
 * Resolves what a `subscription.active` webhook is activating.
 *
 * Only sources drawn from THIS event's payload are used — both are
 * session-correlated, because they come from the very checkout session that
 * just completed and fired this webhook:
 *
 *   1. PRIMARY: `payload.data.metadata` — createCheckoutForOrg writes
 *      `metadata: { organizationId, kind: "AGENT", agent }` on the Dodo
 *      checkout session, and Dodo echoes that exact metadata back on the
 *      subscription webhook for that subscription.
 *   2. FALLBACK: `product_id` → catalog resolution (`resolveAgentFromProductId`),
 *      also read from this same event's payload.
 *
 * PendingCheckout is deliberately NOT consulted here, even though it is our
 * own record of "what the org checked out for." Dodo does not echo back a
 * `checkout_session_id` on the subscription payload (verified:
 * createCheckoutForOrg never puts one in `metadata`, and
 * the WebhookPayload shape has no such field), so a PendingCheckout row
 * cannot be tied to the specific session that completed. An org can have
 * multiple PendingCheckout rows in flight (e.g. an abandoned Maya checkout
 * followed by a Rex checkout the user actually completes) — picking "most
 * recent for the org" is a pure recency guess, not a correlation to this
 * event, and CAN resolve to a DIFFERENT agent/plan than the one the customer
 * actually paid for. That is a money bug (customer pays for Maya, gets Rex
 * provisioned), so PendingCheckout must never decide `kind`, `agent`, or
 * `plan` — see cleanupPendingCheckouts below for its one remaining
 * (non-deciding) use.
 *
 * Never defaults to an agent or to ALL_AGENTS: an unresolved agent returns
 * `null` and the caller must fail closed.
 */
function resolveActivationIntent(
  payload: WebhookPayload,
): { kind: CheckoutKind; agent: Agent | null; plan: SubscriptionPlan } | null {
  const metaKind = payload.data.metadata?.kind;
  const kind: CheckoutKind | undefined = (isCheckoutKind(metaKind) ? metaKind : undefined)
    ?? (payload.data.product_id && resolveAgentFromProductId(payload.data.product_id) ? "AGENT" : undefined);

  if (!kind) return null;

  const metaAgent = payload.data.metadata?.agent;
  const agent: Agent | null = (isAgentValue(metaAgent) ? metaAgent : null)
    ?? (payload.data.product_id ? resolveAgentFromProductId(payload.data.product_id) : null);

  return { kind: "AGENT", agent, plan: "MONTHLY" };
}

/**
 * Best-effort cleanup of PendingCheckout rows after a `subscription.active`
 * webhook has been resolved and provisioned.
 *
 * PendingCheckout rows cannot be correlated to the session that just
 * completed (see resolveActivationIntent's doc comment above), so this must
 * NOT delete "whichever row happens to exist" — that is exactly the bug
 * being fixed: a wrong pick can delete the abandoned row and leave the real
 * (still-pending-looking) one behind forever. Instead this deletes rows that
 * describe the SAME purchase this webhook just confirmed — same `kind`, and
 * for AGENT the same `agent` — which is safe because it only ever removes a
 * row for the purchase that was actually just provisioned.
 *
 * It also sweeps rows older than 24 hours for this org. Nothing else ever
 * expires a PendingCheckout: an abandoned checkout (user closes the tab, or
 * completes a different one instead) is never confirmed by ANY webhook, so
 * it must be aged out here rather than waited on — otherwise it lingers
 * indefinitely as UI-only "checkout syncing" noise and stale bait for a
 * future recency-based mistake.
 */
async function cleanupPendingCheckouts(
  orgId: string,
  intent: { kind: CheckoutKind; agent: Agent | null },
): Promise<void> {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.pendingCheckout
    .deleteMany({
      where: {
        organizationId: orgId,
        OR: [
          {
            kind: intent.kind,
            ...(intent.kind === "AGENT" ? { agent: intent.agent } : {}),
          },
          { createdAt: { lt: staleBefore } },
        ],
      },
    })
    .catch((e) => console.error("[billing] failed to clean up pending checkouts", orgId, e));
}

export async function handleSubscriptionActive(payload: WebhookPayload) {
  const dodoSubId = payload.data.subscription_id;
  const periodEnd = parsePeriodEnd(payload.data);
  const orgId = findOrgIdFromPayload(payload)
    ?? (await findOrgIdByCustomer(payload.data.customer?.customer_id));

  if (!orgId || !dodoSubId || !periodEnd) {
    console.warn("[billing] active webhook: unresolved", {
      orgId, dodoSubId, hasPeriodEnd: Boolean(periodEnd),
    });
    return;
  }

  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    // Idempotency beyond the event ledger: if this Dodo sub is already
    // provisioned, a replay must not create a second BillingSubscription.
    const existing = await prisma.billingSubscription.findUnique({
      where: { dodoSubscriptionId: dodoSubId },
    });
    if (existing) return "ignored-already-provisioned";

    const intent = resolveActivationIntent(payload);
    if (!intent) {
      console.warn("[billing] active webhook: unresolved intent", { orgId, dodoSubId });
      return "ignored-unresolved-agent";
    }

    // Fail closed: never default to an agent. The payment is already
    // captured, so support can provision manually — a defensive default here
    // would silently grant the wrong agent, or every agent for the price of
    // one, which is invisible revenue loss.
    if (!intent.agent) {
      console.warn("[billing] active webhook: unresolved agent", { orgId, dodoSubId });
      return "ignored-unresolved-agent";
    }

    await applyAgentActivation({
      organizationId: orgId,
      dodoSubscriptionId: dodoSubId,
      agent: intent.agent,
      periodEnd,
    });
    await cleanupPendingCheckouts(orgId, intent);
    return "applied-agent";
  });
}

/**
 * Extends ONLY the entitlements billed by the renewed Dodo subscription.
 * Maya renewing on day 30 must not touch Rex's day-40 row — hence every
 * write below is scoped to `billingSubscriptionId: bs.id`.
 */
export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const periodEnd = parsePeriodEnd(payload.data);
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId || !periodEnd) return;

  const orgId = await resolveOrgIdForSubscription(dodoSubId);
  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";
    // Out-of-order guard: never move a period backwards.
    if (periodEnd <= bs.currentPeriodEnd) return "ignored-stale-period";

    await prisma.$transaction([
      prisma.billingSubscription.update({
        where: { id: bs.id },
        data: { status: "ACTIVE", currentPeriodEnd: periodEnd },
      }),
      // Only THIS subscription's agents move. Other agents are untouched.
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
        data: { status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
      }),
    ]);
    return "applied-renewed";
  });
}

/**
 * Marks the Dodo subscription (and only its own entitlements) as scheduled
 * to stop at period end. Access is retained through the already-paid
 * period — the sweeper expires the rows when it lapses.
 */
export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId) return;

  const orgId = await resolveOrgIdForSubscription(dodoSubId);
  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";

    await prisma.$transaction([
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { cancelAtPeriodEnd: true } }),
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
        data: { cancelAtPeriodEnd: true },
      }),
    ]);
    return "applied-cancelled";
  });
}

/**
 * Shared by handleSubscriptionExpired and handleSubscriptionFailed: both
 * end access for exactly one Dodo subscription's entitlements, scoped by
 * `billingSubscriptionId`, never the whole org.
 */
async function expireBillingSubscription(payload: WebhookPayload, resultTag: string) {
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId) return;

  const orgId = await resolveOrgIdForSubscription(dodoSubId);
  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";

    await prisma.$transaction([
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { status: "EXPIRED" } }),
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
        data: { status: "EXPIRED" },
      }),
    ]);
    return resultTag;
  });
}

export async function handleSubscriptionExpired(payload: WebhookPayload) {
  return expireBillingSubscription(payload, "applied-expired");
}

export async function handleSubscriptionFailed(payload: WebhookPayload) {
  return expireBillingSubscription(payload, "applied-failed");
}

/**
 * Marks ONLY the failing Dodo subscription's entitlements PAST_DUE. The old
 * handler set the whole org PAST_DUE, killing all six agents over one bad
 * card on a single agent's subscription.
 */
export async function handlePaymentFailed(payload: WebhookPayload) {
  const dodoSubId = payload.data.subscription_id;
  if (!dodoSubId) return;

  const orgId = await resolveOrgIdForSubscription(dodoSubId);
  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, orgId, async () => {
    const bs = await prisma.billingSubscription.findUnique({ where: { dodoSubscriptionId: dodoSubId } });
    if (!bs) return "ignored-unknown-subscription";

    await prisma.$transaction([
      prisma.billingSubscription.update({ where: { id: bs.id }, data: { status: "PAST_DUE" } }),
      prisma.entitlement.updateMany({
        where: { billingSubscriptionId: bs.id, status: "ACTIVE" },
        data: { status: "PAST_DUE" },
      }),
    ]);
    return "applied-payment-failed";
  });
}

/**
 * Grants Maya credits for a completed one-time top-up payment. This is the
 * only `payment.succeeded` handler in the module — every other purchase in
 * this app is a subscription, provisioned on `subscription.active` instead.
 *
 * Ignores any `payment.succeeded` payload that isn't a top-up (metadata.kind
 * check) so a future subscription-payment echo on this same event type can
 * never accidentally grant credits.
 *
 * Credits are computed from Dodo's own `product_cart` (what was actually
 * charged) in preference to our own checkout-time metadata (what we merely
 * intended) — the cart is closer to ground truth. A mismatch between the two
 * is logged, not treated as fatal.
 */
export async function handleMayaTopupPaymentSucceeded(payload: WebhookPayload) {
  if (payload.data.metadata?.kind !== "MAYA_TOPUP") return;

  const orgId = findOrgIdFromPayload(payload)
    ?? (await findOrgIdByCustomer(payload.data.customer?.customer_id));
  if (!orgId) {
    console.warn("[billing] topup webhook: unresolved org", payload);
    return;
  }

  return withWebhookEvent(providerEventId(payload), payload.type, undefined, orgId, async () => {
    const cart = payload.data.product_cart ?? [];
    const creditsFromCart = (cart[0]?.quantity ?? 0) * TOPUP_CREDITS_PER_UNIT;
    const creditsFromMetadata = Number(payload.data.metadata?.credits ?? 0);
    const credits = creditsFromCart > 0 ? creditsFromCart : creditsFromMetadata;

    if (credits <= 0) {
      console.warn("[billing] topup webhook: no credits resolved", orgId);
      return "ignored-no-credits";
    }
    if (creditsFromCart > 0 && creditsFromMetadata > 0 && creditsFromCart !== creditsFromMetadata) {
      console.warn("[billing] topup credits mismatch — cart vs metadata", { orgId, creditsFromCart, creditsFromMetadata });
    }

    // Known edge case, not solved here: if the org's Maya entitlement has
    // lapsed between checkout and webhook delivery, grantPurchasedTopupCredits
    // throws "no-subscription" (there is no window to grant the credit
    // into) — the payment was captured but there's nowhere to apply it.
    // withWebhookEvent's catch releases the claim and rethrows, so Dodo
    // retries indefinitely on an unrecoverable condition. This mirrors the
    // existing house style elsewhere in this file (idempotent-retry-forever)
    // rather than inventing new dead-letter infrastructure.
    await grantPurchasedTopupCredits(orgId, credits);

    await prisma.pendingCheckout
      .deleteMany({ where: { organizationId: orgId, kind: "MAYA_TOPUP" } })
      .catch((e) => console.error("[billing] failed to clean up topup pending checkout", orgId, e));

    return `applied-topup:${credits}`;
  });
}
