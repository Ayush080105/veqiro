"use client"

import { ApiError } from "@/lib/api/client"

/**
 * Maps the raw error strings billing.cancel.ts / billing.service.ts throw
 * (`shared-subscription:<AGENTS>`, `covered-by-crew:<AGENT>`, etc.) to copy a
 * user can act on. These come back as ApiError.message from BadRequestError /
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
  if (message.startsWith("covered-by-crew:")) {
    return "This agent is covered by your Crew plan, not its own subscription. Cancel the Crew plan if you want to stop billing for it."
  }
  if (message === "no-subscription-for-agent") {
    return "We couldn't find a billing subscription for this agent. Contact support."
  }
  if (message.startsWith("not-entitled:")) {
    return "You don't currently own this agent."
  }
  if (message === "crew-covers-all-agents") {
    return "Your Crew plan already includes this agent."
  }
  if (message.startsWith("already-entitled:")) {
    return "You already own this agent."
  }

  return message || fallback
}
