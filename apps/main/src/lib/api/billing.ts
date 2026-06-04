import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "CANCELLED" | "PAST_DUE" | "EXPIRED";
export type SubscriptionPlan = "MONTHLY" | "ANNUAL";

export type BillingSubscription = {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  dodoCustomerId: string | null;
};

export type BillingStatusResponse = {
  subscription: BillingSubscription | null;
};

export type StartTrialResponse = {
  status: "TRIALING";
  trialEndsAt: string;
  plan: null;
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

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}
