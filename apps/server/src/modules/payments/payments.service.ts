import DodoPayments from "dodopayments";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { SubscriptionStatus } from "../../../prisma/generated/prisma/enums.js";

const dodo = new DodoPayments({
  bearerToken: env.DODO_PAYMENTS_API_KEY!,
  environment: env.NODE_ENV === "production" ? "live_mode" : "test_mode",
});

// TODO: replace with Redis SET NX for distributed, persistent idempotency
const processedEvents = new Set<string>();

export const createCheckoutSession = async (
  userId: string,
  organizationId: string,
  productId: string,
  customerEmail: string,
  customerName?: string,
  couponCode?: string
): Promise<string> => {
  const result = await dodo.subscriptions.create({
    billing: { country: "IN" },
    customer: { email: customerEmail, name: customerName ?? customerEmail.split("@")[0] },
    product_id: productId,
    quantity: 1,
    payment_link: true,
    // Both UPI (upi_collect, upi_intent) and cards shown on hosted checkout page.
    // UPI autopay confirmation is asynchronous — subscription activation is handled
    // exclusively via the subscription.active webhook, never assumed here.
    allowed_payment_method_types: ["credit", "debit", "upi_collect", "upi_intent"],
    metadata: { userId, organizationId },
    return_url: `${env.CLIENT_URL}/settings/billing`,
    ...(couponCode ? { discount_code: couponCode } : {}),
  });

  if (!result.payment_link) {
    throw new Error("Dodo Payments did not return a payment link");
  }

  return result.payment_link;
};

export const getSubscription = async (organizationId: string) => {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true, subscriptionId: true, nextBillingDate: true, canceledAt: true },
  });
  return sub ?? { status: SubscriptionStatus.FREE, subscriptionId: null, nextBillingDate: null, canceledAt: null };
};

export const cancelSubscription = async (organizationId: string) => {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { subscriptionId: true },
  });

  if (!sub?.subscriptionId) throw new Error("No active subscription found");

  await dodo.subscriptions.update(sub.subscriptionId, {
    cancel_at_next_billing_date: true,
    cancel_reason: "cancelled_by_customer",
  });

  // Mark locally so UI reflects the pending cancellation immediately
  await prisma.subscription.update({
    where: { organizationId },
    data: { canceledAt: new Date() },
  });
};

export const syncSubscription = async (organizationId: string) => {
  const productId = env.DODO_PRODUCT_ID;
  if (!productId) throw new Error("DODO_PRODUCT_ID not configured");

  for await (const s of dodo.subscriptions.list({ product_id: productId, status: "active", page_size: 100 })) {
    if ((s.metadata as Record<string, string>)?.organizationId !== organizationId) continue;

    const status =
      s.status === "active" ? SubscriptionStatus.ACTIVE
      : s.status === "cancelled" ? SubscriptionStatus.CANCELED
      : s.status === "on_hold" || s.status === "failed" ? SubscriptionStatus.PAST_DUE
      : SubscriptionStatus.FREE;

    // If Dodo says the subscription will cancel at next billing date, preserve that marker
    const canceledAt = s.cancel_at_next_billing_date ? new Date() : null;

    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        subscriptionId: s.subscription_id,
        productId: s.product_id,
        status,
        nextBillingDate: new Date(s.next_billing_date),
        canceledAt,
      },
      update: {
        subscriptionId: s.subscription_id,
        productId: s.product_id,
        status,
        nextBillingDate: new Date(s.next_billing_date),
        canceledAt,
      },
    });
    return { synced: true, status };
  }

  return { synced: false, status: SubscriptionStatus.FREE };
};

export const getInvoices = async (organizationId: string) => {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { subscriptionId: true },
  });

  if (!sub?.subscriptionId) return [];

  const page = await dodo.payments.list({ subscription_id: sub.subscriptionId, page_size: 50 });

  return page.items.map((p) => ({
    paymentId: p.payment_id,
    invoiceId: p.invoice_id ?? null,
    invoiceUrl: p.invoice_url ?? null,
    date: p.created_at,
    amount: p.total_amount,
    currency: p.currency,
    status: p.status ?? "unknown",
  }));
};

export const verifyAndParseWebhook = (
  rawBody: string,
  headers: Record<string, string>
): UnwrapWebhookEvent => {
  return dodo.webhooks.unwrap(rawBody, {
    headers,
    key: env.DODO_WEBHOOK_SECRET!,
  });
};

export const processWebhookEvent = async (
  event: UnwrapWebhookEvent
): Promise<void> => {
  const eventKey = `${event.type}::${event.business_id}::${event.timestamp}`;
  if (processedEvents.has(eventKey)) return;
  processedEvents.add(eventKey);

  switch (event.type) {
    case "subscription.active": {
      const { subscription_id, product_id, next_billing_date, metadata } = event.data;
      const organizationId = (metadata as Record<string, string>)?.organizationId;
      if (!organizationId) break;
      await prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          subscriptionId: subscription_id,
          productId: product_id,
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: new Date(next_billing_date),
        },
        update: {
          subscriptionId: subscription_id,
          productId: product_id,
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: new Date(next_billing_date),
          canceledAt: null,
        },
      });
      break;
    }

    case "payment.failed": {
      const subscriptionId = event.data.subscription_id;
      if (subscriptionId) {
        await prisma.subscription.updateMany({
          where: { subscriptionId },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
      }
      break;
    }

    case "subscription.cancelled": {
      const { subscription_id } = event.data;
      await prisma.subscription.updateMany({
        where: { subscriptionId: subscription_id },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      });
      break;
    }

    case "subscription.renewed": {
      const { subscription_id, next_billing_date, previous_billing_date } = event.data;
      await prisma.subscription.updateMany({
        where: { subscriptionId: subscription_id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: new Date(next_billing_date),
          previousBillingDate: new Date(previous_billing_date),
        },
      });
      break;
    }

    default:
      break;
  }
};
