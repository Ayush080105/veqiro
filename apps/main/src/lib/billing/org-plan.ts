/**
 * The label for the badge beside the organization name in the switcher.
 *
 * It used to read "Free" for every organization, always. Plans are per-agent
 * entitlements now (there is no organization-level tier), so the honest label
 * is derived from what the organization actually holds — and is absent when it
 * holds nothing, rather than asserting something untrue.
 */

export interface PlanEntitlement {
  source: "TRIAL" | "AGENT"
  status: "TRIALING" | "ACTIVE" | "PAST_DUE"
}

export type OrgPlanLabel = "Trial" | "Paid" | "Past due"

export function orgPlanLabel(entitlements: readonly PlanEntitlement[] | undefined): OrgPlanLabel | null {
  if (!entitlements || entitlements.length === 0) return null
  // A failed payment needs action, so it outranks everything else.
  if (entitlements.some((e) => e.status === "PAST_DUE")) return "Past due"
  if (entitlements.some((e) => e.source === "AGENT" && e.status === "ACTIVE")) return "Paid"
  return "Trial"
}
