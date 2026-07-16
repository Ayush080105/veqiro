import { prisma } from "../../config/prisma.js";
import { dodoClient } from "../../lib/dodo.js";
import {
  ALL_AGENTS,
  getAgentMonthlyPriceCents,
  getCrewPriceCents,
  resolveAgentFromProductId,
  resolveCrewPlanFromProductId,
} from "./billing.catalog.js";
import type { Agent, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";

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
    // (applyAgentActivation, applyCrewActivation, ...) has committed. Only
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
 */
export function providerEventId(payload: WebhookPayload): string {
  const id = (payload as { id?: string; webhook_id?: string }).id
    ?? (payload as { webhook_id?: string }).webhook_id;
  if (id) return id;
  const period = payload.data.next_billing_date ?? payload.data.current_period_end ?? "no-period";
  return `${payload.type}:${payload.data.subscription_id ?? "none"}:${period}`;
}

type CheckoutKind = "AGENT" | "CREW" | "CREW_UPGRADE";

function isCheckoutKind(value: unknown): value is CheckoutKind {
  return value === "AGENT" || value === "CREW" || value === "CREW_UPGRADE";
}

function isAgentValue(value: unknown): value is Agent {
  return typeof value === "string" && (ALL_AGENTS as string[]).includes(value);
}

function isPlanValue(value: unknown): value is SubscriptionPlan {
  return value === "MONTHLY" || value === "ANNUAL";
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
 * Provisions Crew: six CREW rows, and supersedes any AGENT rows the upgrade
 * credited. Their Dodo subs are told to stop at period end so the customer is
 * never charged twice — the already-paid time is what the upgrade discount
 * credited them for.
 *
 * SUPERSEDED (not delete) keeps this reversible if the Crew payment is later
 * refunded or reversed. billing.cancel.ts's per-agent cancel/resume relies on
 * AGENT/CREW overlap being resolvable, so getting this right is load-bearing.
 *
 * priceCents per row is floor(crewPrice / 6), never each agent's individual
 * list price — stamping list price here would let a future Crew-upgrade
 * quote (which sums AGENT-source priceCents) massively overcredit the org.
 */
export async function applyCrewActivation(input: {
  organizationId: string;
  dodoSubscriptionId: string;
  plan: SubscriptionPlan;
  periodEnd: Date;
}) {
  const now = new Date();
  const perAgentCents = Math.floor(getCrewPriceCents(input.plan) / ALL_AGENTS.length);

  const superseded = await prisma.$transaction(async (tx) => {
    const bs = await tx.billingSubscription.create({
      data: {
        organizationId: input.organizationId,
        dodoSubscriptionId: input.dodoSubscriptionId,
        plan: input.plan,
        status: "ACTIVE",
        currentPeriodEnd: input.periodEnd,
      },
    });

    const priorAgentRows = await tx.entitlement.findMany({
      where: {
        organizationId: input.organizationId,
        source: "AGENT",
        status: { in: ["ACTIVE", "PAST_DUE"] },
        currentPeriodEnd: { gt: now },
      },
      select: { id: true, billingSubscriptionId: true },
    });

    await tx.entitlement.createMany({
      data: ALL_AGENTS.map((agent) => ({
        organizationId: input.organizationId,
        agent,
        source: "CREW" as const,
        status: "ACTIVE" as const,
        currentPeriodStart: now,
        currentPeriodEnd: input.periodEnd,
        priceCents: perAgentCents,
        billingSubscriptionId: bs.id,
      })),
    });

    if (priorAgentRows.length > 0) {
      await tx.entitlement.updateMany({
        where: { id: { in: priorAgentRows.map((r) => r.id) } },
        data: { status: "SUPERSEDED" },
      });
    }

    return [...new Set(priorAgentRows.map((r) => r.billingSubscriptionId).filter((id): id is string => Boolean(id)))];
  });

  // Stop the superseded subs at their period end. Outside the transaction:
  // these are external calls and must not hold a DB lock. Failure here is
  // recoverable (support/a reconciler can retry) and must NOT roll back the
  // Crew grant the customer has already paid for.
  for (const bsId of superseded) {
    const bs = await prisma.billingSubscription.findUnique({ where: { id: bsId } });
    if (!bs) continue;
    await dodoClient.subscriptions
      .update(bs.dodoSubscriptionId, { cancel_at_next_billing_date: true })
      .catch((e) => console.error("[billing] failed to stop superseded sub", bs.dodoSubscriptionId, e));
    await prisma.billingSubscription
      .update({ where: { id: bsId }, data: { cancelAtPeriodEnd: true } })
      .catch((e) => console.error("[billing] failed to flag superseded sub cancelAtPeriodEnd", bsId, e));
  }
}

/**
 * Resolves what a `subscription.active` webhook is activating.
 *
 * Dodo does not echo back a `checkout_session_id` on the subscription
 * payload (verified: createCheckoutForOrg / createCrewCheckout never put one
 * in `metadata`, and the WebhookPayload shape has no such field), so
 * PendingCheckout cannot be looked up by session id. Instead:
 *
 *   1. PRIMARY: the most recent PendingCheckout row for this org. This is
 *      our own authoritative record of what the org just checked out for,
 *      written synchronously before the checkout URL was ever returned to
 *      the browser — by the time Dodo's webhook fires (after the user
 *      actually completes payment) this row is essentially guaranteed to
 *      exist.
 *   2. FALLBACK: `payload.data.metadata` — createCheckoutForOrg and
 *      createCrewCheckout both set `metadata: { organizationId, kind,
 *      agent | plan }` on the Dodo checkout session, and Dodo echoes
 *      metadata back on the subscription webhook (this is how the pre-6.1
 *      handler already resolved `plan`/`entitlementMode`). Covers the
 *      unlikely-but-possible race where the webhook beats our own
 *      PendingCheckout write.
 *   3. LAST RESORT: `product_id` → catalog resolution.
 *
 * Never defaults to an agent or to ALL_AGENTS: an unresolved agent returns
 * `null` and the caller must fail closed.
 */
function resolveActivationIntent(
  payload: WebhookPayload,
  pending: { kind: CheckoutKind; agent: Agent | null; plan: SubscriptionPlan } | null,
): { kind: CheckoutKind; agent: Agent | null; plan: SubscriptionPlan } | null {
  const metaKind = payload.data.metadata?.kind;
  const kind: CheckoutKind | undefined = pending?.kind
    ?? (isCheckoutKind(metaKind) ? metaKind : undefined)
    ?? (payload.data.product_id && resolveCrewPlanFromProductId(payload.data.product_id) ? "CREW" : undefined)
    ?? (payload.data.product_id && resolveAgentFromProductId(payload.data.product_id) ? "AGENT" : undefined);

  if (!kind) return null;

  if (kind === "CREW" || kind === "CREW_UPGRADE") {
    const metaPlan = payload.data.metadata?.plan;
    const plan: SubscriptionPlan = pending?.plan
      ?? (isPlanValue(metaPlan) ? metaPlan : undefined)
      ?? (payload.data.product_id ? resolveCrewPlanFromProductId(payload.data.product_id) : null)
      ?? "MONTHLY";
    return { kind, agent: null, plan };
  }

  const metaAgent = payload.data.metadata?.agent;
  const agent: Agent | null = pending?.agent
    ?? (isAgentValue(metaAgent) ? metaAgent : null)
    ?? (payload.data.product_id ? resolveAgentFromProductId(payload.data.product_id) : null);

  return { kind: "AGENT", agent, plan: "MONTHLY" };
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

    const pending = await prisma.pendingCheckout.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    const intent = resolveActivationIntent(payload, pending);
    if (!intent) {
      console.warn("[billing] active webhook: unresolved intent", { orgId, dodoSubId });
      return "ignored-unresolved-agent";
    }

    if (intent.kind === "CREW" || intent.kind === "CREW_UPGRADE") {
      await applyCrewActivation({
        organizationId: orgId,
        dodoSubscriptionId: dodoSubId,
        plan: intent.plan,
        periodEnd,
      });
      if (pending) await prisma.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});
      return "applied-crew";
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
    if (pending) await prisma.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});
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

  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
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

  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
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

  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
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

  return withWebhookEvent(providerEventId(payload), payload.type, dodoSubId, null, async () => {
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
