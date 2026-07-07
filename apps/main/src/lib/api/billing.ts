import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "@/lib/query-keys";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED";
export type SubscriptionPlan = "MONTHLY" | "ANNUAL";
export type BillingAgent = "MAYA" | "SAGE" | "LEX" | "REX" | "SCOUT" | "VEGA";
export type EntitlementMode = "CREW" | "CUSTOM";

export type BillingSubscription = {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  dodoCustomerId: string | null;
  entitlementMode: EntitlementMode;
  selectedAgents: BillingAgent[];
  unlockedAgents: BillingAgent[];
  pendingCheckout: {
    plan: SubscriptionPlan | null;
    entitlementMode: EntitlementMode | null;
    selectedAgents: BillingAgent[];
  } | null;
};

export type BillingStatusResponse = {
  subscription: BillingSubscription | null;
};

export type StartTrialResponse = {
  status: "TRIALING";
  trialEndsAt: string;
  plan: null;
  entitlementMode: EntitlementMode;
  selectedAgents: BillingAgent[];
};

export const billingStatusQueryKey = (organizationId?: string | null) =>
  ["billing", "status", organizationId ?? "none"] as const;

export function getBillingStatus() {
  return apiFetch<BillingStatusResponse>("/billing/status");
}

export function useBillingStatus(organizationId?: string | null) {
  return useQuery({
    queryKey: billingStatusQueryKey(organizationId),
    queryFn: getBillingStatus,
    enabled: Boolean(organizationId),
  });
}

export function startTrial() {
  return apiFetch<StartTrialResponse>("/billing/start-trial", { method: "POST" });
}

export function createCheckout(input: {
  agents: BillingAgent[];
  cadence: SubscriptionPlan;
}) {
  return apiFetch<{ url: string }>("/billing/checkout", {
    method: "POST",
    body: input,
  });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}

// ─── Maya usage ───────────────────────────────────────────────────────────────

export type MayaUsageTier = "TRIAL" | "MONTHLY_CUSTOM" | "MONTHLY_CREW" | "ANNUAL_CREW";

export type UsageResource = {
  used: number;
  limit: number;
  remaining: number;
};

export type MayaUsageResponse = {
  tier: MayaUsageTier;
  periodStart: string;
  periodEnd: string;
  credits: UsageResource;
};

export function getMayaUsage() {
  return apiFetch<MayaUsageResponse>("/agents/maya/usage");
}

export function useMayaUsage(organizationId?: string | null) {
  return useQuery({
    queryKey: qk.mayaUsage(organizationId ?? ""),
    queryFn: getMayaUsage,
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });
}

// null means "unknown" (loading/no data yet) — callers should treat that as
// "don't block", not as zero remaining.
export function useMayaRemainingCredits(organizationId?: string | null) {
  const { data, isPending } = useMayaUsage(organizationId);
  return {
    creditsRemaining: data ? data.credits.remaining : null,
    isLoading: isPending,
  };
}
