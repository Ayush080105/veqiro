import { toast } from "sonner"

import { ApiError } from "./client"

// apiFetch (./client.ts) already fires a global "Something went wrong" toast
// for every 5xx response, so callers must not toast again for those — this
// returns null to signal "already handled, don't toast."
export function friendlyErrorMessage(err: unknown, fallback = "Something went wrong."): string | null {
  if (err instanceof ApiError) {
    if (err.status === 429 && /^Maya credits exceeded/.test(err.message)) {
      return "You're out of credits for this period. Upgrade your plan or top up to keep going."
    }
    if (err.status >= 500) return null
    return err.message || fallback
  }
  if (err instanceof Error) return err.message || fallback
  return fallback
}

export function toastFriendlyError(err: unknown, fallback?: string) {
  const message = friendlyErrorMessage(err, fallback)
  if (message) toast.error(message)
}
