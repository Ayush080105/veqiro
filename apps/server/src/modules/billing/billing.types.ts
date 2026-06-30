import {
  Agent,
  SubscriptionEntitlementMode,
  SubscriptionStatus,
  SubscriptionPlan,
} from "../../../prisma/generated/prisma/client.js";
import { ALL_AGENTS } from "./billing.catalog.js";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  entitlementMode?: SubscriptionEntitlementMode | null;
  selectedAgents?: Agent[] | null;
};

export type DerivedEntitlement = {
  subscriptionStatus: SubscriptionStatus;
  entitlementExpiresAt: Date | null;
  unlockedAgents: Agent[];
};

/** Map a Dodo product_id to our internal plan enum. Returns null if unknown. */
export function resolvePlan(productId: string): SubscriptionPlan | null {
  if (productId === process.env.DODO_PRO_MONTHLY_PRODUCT_ID) return "MONTHLY";
  if (productId === process.env.DODO_PRO_ANNUAL_PRODUCT_ID)  return "ANNUAL";
  if (productId === process.env.DODO_CUSTOM_MONTHLY_PRODUCT_ID) return "MONTHLY";
  if (productId === process.env.DODO_CUSTOM_ANNUAL_PRODUCT_ID)  return "ANNUAL";
  return null;
}

export function resolveEntitlementMode(productId: string): SubscriptionEntitlementMode | null {
  if (
    productId === process.env.DODO_PRO_MONTHLY_PRODUCT_ID ||
    productId === process.env.DODO_PRO_ANNUAL_PRODUCT_ID
  ) {
    return "CREW";
  }
  if (
    productId === process.env.DODO_CUSTOM_MONTHLY_PRODUCT_ID ||
    productId === process.env.DODO_CUSTOM_ANNUAL_PRODUCT_ID
  ) {
    return "CUSTOM";
  }
  return null;
}

export function parseEntitlementModeMetadata(value: unknown): SubscriptionEntitlementMode | null {
  return value === "CREW" || value === "CUSTOM" ? value : null;
}

export function parsePlanMetadata(value: unknown): SubscriptionPlan | null {
  return value === "MONTHLY" || value === "ANNUAL" ? value : null;
}

export function parseAgentsMetadata(value: unknown): Agent[] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const agents = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (!agents.every((agent): agent is Agent => ALL_AGENTS.includes(agent as Agent))) {
    return null;
  }
  return [...new Set(agents)] as Agent[];
}

/**
 * Derives the two denormalized Organization fields from a Subscription row.
 * Encoding rules per spec:
 *   TRIALING               → entitlementExpiresAt = trialEndsAt
 *   CANCELLED              → entitlementExpiresAt = currentPeriodEnd
 *   ACTIVE/PAST_DUE/EXPIRED → entitlementExpiresAt = null
 */
export function deriveEntitlementFields(sub: SubscriptionLike): DerivedEntitlement {
  const unlockedAgents = sub.entitlementMode === "CUSTOM"
    ? sub.selectedAgents ?? []
    : sub.entitlementMode === "CREW"
      ? ALL_AGENTS
      : sub.selectedAgents?.length
        ? sub.selectedAgents
        : [];

  switch (sub.status) {
    case "TRIALING":
      return { subscriptionStatus: "TRIALING", entitlementExpiresAt: sub.trialEndsAt, unlockedAgents };
    case "CANCELLED":
      return { subscriptionStatus: "CANCELLED", entitlementExpiresAt: sub.currentPeriodEnd, unlockedAgents };
    case "ACTIVE":
    case "PAST_DUE":
    case "EXPIRED":
      return { subscriptionStatus: sub.status, entitlementExpiresAt: null, unlockedAgents };
  }
}
