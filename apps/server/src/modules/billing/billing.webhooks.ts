import { prisma } from "../../config/prisma.js";
import { syncOrgEntitlement } from "./billing.service.js";
import { resolvePlan } from "./billing.types.js";

type WebhookPayload = {
  event_type: string;
  data: {
    customer?: { customer_id?: string };
    subscription_id?: string;
    product_id?: string;
    next_billing_date?: string;
    current_period_end?: string;
  };
};

async function findOrgIdByCustomer(customerId: string | undefined): Promise<string | null> {
  if (!customerId) return null;
  const sub = await prisma.subscription.findFirst({
    where: { dodoCustomerId: customerId },
    select: { organizationId: true },
  });
  return sub?.organizationId ?? null;
}

function parsePeriodEnd(p: WebhookPayload["data"]): Date | null {
  const v = p.next_billing_date ?? p.current_period_end;
  return v ? new Date(v) : null;
}

export async function handleSubscriptionActive(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return console.warn("[billing] active webhook: no org for customer", payload.data.customer?.customer_id);

  const plan = payload.data.product_id ? resolvePlan(payload.data.product_id) : null;
  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    plan,
    dodoSubscriptionId: payload.data.subscription_id,
    currentPeriodEnd: parsePeriodEnd(payload.data),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
  });
}

export async function handleSubscriptionRenewed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, {
    status: "ACTIVE",
    currentPeriodEnd: parsePeriodEnd(payload.data),
  });
}

export async function handleSubscriptionCancelled(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, {
    status: "CANCELLED",
    cancelAtPeriodEnd: true,
  });
}

export async function handleSubscriptionExpired(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
}

export async function handleSubscriptionFailed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "EXPIRED" });
}

export async function handlePaymentFailed(payload: WebhookPayload) {
  const orgId = await findOrgIdByCustomer(payload.data.customer?.customer_id);
  if (!orgId) return;
  await syncOrgEntitlement(orgId, { status: "PAST_DUE" });
}
