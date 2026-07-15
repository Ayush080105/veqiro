import { EntitlementSource, SubscriptionPlan } from "../../../../prisma/generated/prisma/client.js";

export type QuotaTier = "TRIAL" | "MONTHLY_CUSTOM" | "MONTHLY_CREW" | "ANNUAL_CREW";

// Edit these values directly to change per-plan credit budgets.
const QUOTA: Record<QuotaTier, number> = {
  TRIAL:          30,
  MONTHLY_CUSTOM: 300,
  MONTHLY_CREW:   300,
  ANNUAL_CREW:    400,
};

export function getQuotaForTier(tier: QuotaTier): number {
  return QUOTA[tier];
}

// ─── Credit conversion factors ─────────────────────────────────────────────
export const CREDITS_PER_IMAGE = 2;
export const CREDITS_PER_VIDEO_SECOND = 4;

export function imageCreditsFor(count: number): number {
  return count * CREDITS_PER_IMAGE;
}
export function videoCreditsFor(seconds: number): number {
  return seconds * CREDITS_PER_VIDEO_SECOND;
}

// ─── Top-up conversion (frontend stub only today — no purchase flow yet;
// kept here so backend/frontend never drift once a real purchase flow ships) ──
export const TOPUP_DOLLAR_UNIT = 3;
export const TOPUP_CREDITS_PER_UNIT = 50;

// Throws on non-multiples so a future backend purchase handler fails loudly
// on bad input rather than silently truncating/rounding.
export function creditsForTopUpDollars(dollars: number): number {
  if (dollars <= 0 || dollars % TOPUP_DOLLAR_UNIT !== 0) {
    throw new Error(`Top-up amount must be a positive multiple of $${TOPUP_DOLLAR_UNIT}`);
  }
  return (dollars / TOPUP_DOLLAR_UNIT) * TOPUP_CREDITS_PER_UNIT;
}

// ANNUAL is always CREW by design — CUSTOM plans are MONTHLY-only.
// PAST_DUE / CANCELLED keep their purchased tier; entitlement middleware already blocks access.
export function getTierFromSubscription(sub: {
  status: string;
  plan: string | null;
  entitlementMode: string;
}): QuotaTier {
  if (sub.status === "TRIALING") return "TRIAL";
  if (sub.plan === "ANNUAL") return "ANNUAL_CREW";
  if (sub.entitlementMode === "CUSTOM") return "MONTHLY_CUSTOM";
  return "MONTHLY_CREW";
}

/**
 * Maya's monthly credit allowance, read live from her entitlement.
 *
 * ANNUAL grants 400 *per month*, not per year: the credit period is a fixed
 * 1-month window decoupled from the billing period (see spec, Decision 6).
 * The previous code granted 400 for the entire year.
 */
export function getQuotaForMayaEntitlement(e: {
  source: EntitlementSource;
  plan: SubscriptionPlan | null;
}): number {
  if (e.source === "TRIAL") return 30;
  if (e.source === "CREW" && e.plan === "ANNUAL") return 400;
  return 300;
}
