import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "@/lib/query-keys";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED";
export type SubscriptionPlan = "MONTHLY" | "ANNUAL";
export type BillingAgent = "MAYA" | "SAGE" | "LEX" | "REX" | "SCOUT" | "VEGA";
export type EntitlementMode = "CUSTOM";

export type EntitlementSource = "TRIAL" | "AGENT";
export type EntitlementStatus = "TRIALING" | "ACTIVE" | "PAST_DUE";

export type AgentEntitlement = {
  agent: BillingAgent;
  source: EntitlementSource;
  status: EntitlementStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceCents: number;
  // This row's own billing cadence (from its BillingSubscription) — null for
  // TRIAL rows, which have none. Use this instead of the top-level
  // `subscription.plan` field, which is a legacy column that's never updated
  // after the org's first checkout and so can't be trusted for cadence.
  plan: SubscriptionPlan | null;
};

export type BillingSubscription = {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  dodoCustomerId: string | null;
  entitlementMode: EntitlementMode;
  pendingCheckout: {
    kind: "AGENT" | "MAYA_TOPUP";
    agent: BillingAgent | null;
    plan: SubscriptionPlan;
    createdAt: string;
  } | null;
  entitlements: AgentEntitlement[];
};

export type BillingStatusResponse = {
  subscription: BillingSubscription | null;
};

// Matches billing.controller.ts's startTrial response exactly: no plan,
// entitlementMode, or selectedAgents — a trial is all agents, all at once.
export type StartTrialResponse = {
  status: "TRIALING";
  trialEndsAt: string;
  agents: BillingAgent[];
};

// ─── Catalog (public prices, shared with apps/landing) ─────────────────────

export type BillingCatalogResponse = {
  agents: Record<BillingAgent, { priceCents: number }>;
  currency: string;
};

export function getBillingCatalog() {
  return apiFetch<BillingCatalogResponse>("/billing/catalog");
}

// Prices change rarely — cache for an hour rather than the 30s global default.
export function useBillingCatalog() {
  return useQuery({
    queryKey: ["billing", "catalog"] as const,
    queryFn: getBillingCatalog,
    staleTime: 60 * 60 * 1000,
  });
}

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

// Clears a stuck/abandoned "Checkout syncing" state. Only removes the
// PendingCheckout row(s) — never touches entitlements; a webhook that
// arrives after dismissal still provisions normally (see
// dismissPendingCheckout's doc comment on the server).
export function dismissPendingCheckout() {
  return apiFetch<{ dismissed: number }>("/billing/pending-checkout", { method: "DELETE" });
}

// Matches the server's `createCheckoutForOrg` input exactly: an individual
// agent purchase is MONTHLY-only and names exactly one agent — a multi-agent
// purchase is unrepresentable in this type, not merely rejected at runtime.
export type CheckoutInput = { agent: BillingAgent };

// Buying a cancelled-but-unexpired agent resumes auto-pay instead of
// charging again, and the server returns `url: null` for that branch — this
// union forces every caller to check `resumed` before touching `.url`, so
// `window.location.href = result.url` on a null (navigating to the literal
// string "null") is a type error, not a runtime surprise.
export type CheckoutResult =
  | { resumed: true; url: null }
  | { resumed: false; url: string };

export function createCheckout(input: CheckoutInput) {
  return apiFetch<CheckoutResult>("/billing/checkout", {
    method: "POST",
    body: input,
  });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}

// ─── Per-agent cancel/resume ───────────────────────────────────────────────

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

export function startMayaTopupCheckout(input: { dollars: number }) {
  return apiFetch<{ url: string; credits: number; dollars: number }>("/billing/maya/topup/checkout", {
    method: "POST",
    body: input,
  });
}

// ─── Maya usage ───────────────────────────────────────────────────────────────

export type MayaUsageTier = "TRIAL" | "MONTHLY_CUSTOM";

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
