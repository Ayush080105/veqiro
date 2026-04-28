import { apiFetch } from "./client";

export type StartTrialResponse = {
  status: "TRIALING";
  trialEndsAt: string;
  plan: null;
};

export function startTrial() {
  return apiFetch<StartTrialResponse>("/billing/start-trial", { method: "POST" });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
}
