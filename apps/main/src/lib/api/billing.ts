import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "@/lib/query-keys";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED";
export type SubscriptionPlan = "MONTHLY" | "ANNUAL";
export type BillingAgent = "MAYA" | "SAGE" | "LEX" | "REX" | "SCOUT" | "VEGA";
export type EntitlementMode = "CREW" | "CUSTOM";

export type EntitlementSource = "TRIAL" | "AGENT" | "CREW";
export type EntitlementStatus = "TRIALING" | "ACTIVE" | "PAST_DUE";

export type AgentEntitlement = {
  agent: BillingAgent;
  source: EntitlementSource;
  status: EntitlementStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceCents: number;
};

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
  entitlements: AgentEntitlement[];
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

// Entitlements are just the new slice of the same /billing/status payload —
// no separate request, so this rides useBillingStatus's cache/query key.
export function useEntitlements(organizationId?: string | null) {
  const { data, ...rest } = useBillingStatus(organizationId);
  return { entitlements: data?.subscription?.entitlements ?? [], ...rest };
}

export function startTrial() {
  return apiFetch<StartTrialResponse>("/billing/start-trial", { method: "POST" });
}

// Matches the server's `createCheckoutForOrg` input exactly: an individual
// agent purchase is MONTHLY-only and names exactly one agent (no cadence to
// pick), while Crew names a cadence and never an agent. An annual
// individual-agent purchase and a multi-agent purchase are unrepresentable in
// this type, not merely rejected at runtime.
export type CheckoutInput =
  | { crew: true; cadence: SubscriptionPlan; agent?: never }
  | { crew?: false; agent: BillingAgent; cadence?: never };

// Buying a cancelled-but-unexpired agent resumes auto-pay instead of
// charging again, and the server returns `url: null` for that branch — this
// union forces every caller to check `resumed` before touching `.url`, so
// `window.location.href = result.url` on a null (navigating to the literal
// string "null") is a type error, not a runtime surprise.
export type CheckoutResult = { resumed: true; url: null } | { resumed: false; url: string };

export function createCheckout(input: CheckoutInput) {
  return apiFetch<CheckoutResult>("/billing/checkout", {
    method: "POST",
    body: input,
  });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}

// ─── Per-agent cancel/resume + upgrade pricing ─────────────────────────────

// Mirrors the server's UpgradeIneligibleReason (billing.upgrade.ts) exactly —
// not widened to `string` — so an unhandled reason is a compile error here
// rather than a silent fallback in the UI.
export type UpgradeIneligibleReason =
  | "credit-exceeds-crew-price"
  | "no-agents-owned"
  | "already-on-crew";

export type UpgradeQuoteResponse =
  | { eligible: true; creditCents: number; payNowCents: number; discountBasisPoints: number }
  | { eligible: false; creditCents: number; reason: UpgradeIneligibleReason };

export function useUpgradeQuote(organizationId?: string | null, cadence: SubscriptionPlan = "MONTHLY") {
  return useQuery({
    queryKey: ["billing", "upgrade-quote", organizationId ?? "none", cadence] as const,
    queryFn: () => apiFetch<UpgradeQuoteResponse>(`/billing/upgrade-quote?cadence=${cadence}`),
    enabled: Boolean(organizationId),
  });
}

export function cancelAgent(agent: BillingAgent) {
  return apiFetch<{ activeUntil: string }>(`/billing/agents/${agent.toLowerCase()}/cancel`, {
    method: "POST",
  });
}

export function resumeAgent(agent: BillingAgent) {
  return apiFetch<{ renewsOn: string }>(`/billing/agents/${agent.toLowerCase()}/resume`, {
    method: "POST",
  });
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
