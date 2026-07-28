"use client"

import { ApiError } from "@/lib/api/client"
import type { BillingSubscription } from "@/lib/api/billing"

// The request never even reaches maya.usage.service.ts's own "no-subscription"
// check in practice: entitlementMiddlewareForAgent (entitlement.middleware.ts)
// gates the whole /agents/maya/* prefix ahead of the controller and returns
// its own 402 body first, for the same underlying condition (no covering Maya
// entitlement) but with a different message per cause — never having started
// a trial, a lapsed trial, a lapsed paid subscription, or owning other agents
// but not Maya. All four are "no active Maya access" from the frontend's
// perspective and belong in the same empty state.
const NO_MAYA_ACCESS_MESSAGES = new Set([
  "no-subscription",
  "Trial not started",
  "Trial expired",
  "Subscription expired",
  "Agent not purchased",
])

/**
 * True when a Maya usage/credits fetch failed because the org has no
 * covering Maya entitlement (bought other agents only, a lapsed trial, or
 * never started one) — a normal empty state, not an error. Matched here
 * rather than inline at each of the three call sites (credits-pill.tsx,
 * settings/usage/page.tsx, MayaUsageCard.tsx) that previously duplicated it.
 */
export function isNoMayaSubscription(error: unknown): boolean {
  return error instanceof ApiError && NO_MAYA_ACCESS_MESSAGES.has(error.message)
}

/**
 * True when the org has a live (TRIALING/ACTIVE/PAST_DUE, non-expired) Maya
 * entitlement. `sub.entitlements` is already filtered server-side to exactly
 * these statuses (see getActiveEntitlements), so any MAYA row's presence is
 * sufficient — no extra status check needed here.
 *
 * Matches the server's getMayaEntitlement-based guard on the top-up checkout
 * route, which is stricter (and more correct) than checking
 * `sub.status === "ACTIVE"`: a TRIALING or grace-period (PAST_DUE) Maya
 * customer can top up, and an org with no Maya entitlement at all cannot —
 * regardless of what `sub.status` (the legacy org-wide field) happens to say.
 */
export function hasMayaEntitlement(sub: BillingSubscription | null | undefined): boolean {
  return Boolean(sub?.entitlements.some((e) => e.agent === "MAYA"))
}

/**
 * Maps the raw error strings billing.cancel.ts / billing.service.ts throw
 * (`shared-subscription:<AGENTS>`, etc.) to copy a user can act on. These
 * come back as ApiError.message from BadRequestError /
 * ConflictError on the cancel/resume/checkout routes — a different failure
 * class than the 402 upgrade-required codes upgrade-errors.ts handles, but
 * the same principle: never show the raw server string.
 */
export function billingActionErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback
  }

  const message = error.message ?? ""

  // Two legacy orgs were backfilled from an old quantity-hack product with
  // ONE Dodo subscription covering TWO agents. Dodo allows only one
  // subscription per checkout, so that subscription cannot be split
  // server-side — the customer would have to re-purchase. Say so plainly
  // rather than surfacing "shared-subscription:MAYA,REX".
  if (message.startsWith("shared-subscription:")) {
    const agents = (message.split(":")[1] ?? "")
      .split(",")
      .filter(Boolean)
      .map((a) => a.charAt(0) + a.slice(1).toLowerCase())
    const list = agents.length ? agents.join(" and ") : "another agent"
    return `This agent's billing is tied together with ${list} on one legacy subscription, so it can't be cancelled on its own. Contact support to split them.`
  }
  if (message === "no-subscription-for-agent") {
    return "We couldn't find a billing subscription for this agent. Contact support."
  }
  if (message.startsWith("not-entitled:")) {
    return "You don't currently own this agent."
  }
  if (message.startsWith("already-entitled:")) {
    return "You already own this agent."
  }

  return message || fallback
}
