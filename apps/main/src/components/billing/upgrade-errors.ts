"use client"

import { ApiError } from "@/lib/api/client"

const REASON_BY_ERROR: Record<string, string> = {
  "trial not started": "trial-not-started",
  "trial expired": "trial-expired",
  "subscription expired": "subscription-expired",
  "payment failed": "payment-failed",
  "agent not purchased": "agent-not-purchased",
}

export function getUpgradeRequiredReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 402) return null

  const rawReason = error.code ?? error.message
  const normalizedReason = rawReason.trim().toLowerCase()

  return REASON_BY_ERROR[normalizedReason] ?? "default"
}
