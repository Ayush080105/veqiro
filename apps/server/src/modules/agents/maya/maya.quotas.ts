export type QuotaTier = "TRIAL" | "MONTHLY_CUSTOM" | "MONTHLY_CREW" | "ANNUAL_CREW";
export type PlanQuota = { images: number; videoSeconds: number };

// Edit these values directly to change per-plan limits.
const QUOTA: Record<QuotaTier, PlanQuota> = {
  TRIAL:          { images: 20,  videoSeconds: 30  },
  MONTHLY_CUSTOM: { images: 100, videoSeconds: 60  },
  MONTHLY_CREW:   { images: 200, videoSeconds: 120 },
  ANNUAL_CREW:    { images: 300, videoSeconds: 180 },
};

export function getQuotaForTier(tier: QuotaTier): PlanQuota {
  return QUOTA[tier];
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
