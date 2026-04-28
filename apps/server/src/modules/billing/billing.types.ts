import { SubscriptionStatus, SubscriptionPlan } from "../../../prisma/generated/prisma/client.js";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type DerivedEntitlement = {
  subscriptionStatus: SubscriptionStatus;
  entitlementExpiresAt: Date | null;
};

/** Map a Dodo product_id to our internal plan enum. Returns null if unknown. */
export function resolvePlan(productId: string): SubscriptionPlan | null {
  if (productId === process.env.DODO_PRO_MONTHLY_PRODUCT_ID) return "MONTHLY";
  if (productId === process.env.DODO_PRO_ANNUAL_PRODUCT_ID)  return "ANNUAL";
  return null;
}

/**
 * Derives the two denormalized Organization fields from a Subscription row.
 * Encoding rules per spec:
 *   TRIALING               → entitlementExpiresAt = trialEndsAt
 *   CANCELLED              → entitlementExpiresAt = currentPeriodEnd
 *   ACTIVE/PAST_DUE/EXPIRED → entitlementExpiresAt = null
 */
export function deriveEntitlementFields(sub: SubscriptionLike): DerivedEntitlement {
  switch (sub.status) {
    case "TRIALING":
      return { subscriptionStatus: "TRIALING", entitlementExpiresAt: sub.trialEndsAt };
    case "CANCELLED":
      return { subscriptionStatus: "CANCELLED", entitlementExpiresAt: sub.currentPeriodEnd };
    case "ACTIVE":
    case "PAST_DUE":
    case "EXPIRED":
      return { subscriptionStatus: sub.status, entitlementExpiresAt: null };
  }
}
