"use client"

import { Sparkles } from "lucide-react"

import { useMayaUsage } from "@/lib/api/billing"
import { ApiError } from "@/lib/api/client"

export function MayaCreditsPill({ organizationId }: { organizationId: string }) {
  const { data, isPending, error } = useMayaUsage(organizationId)

  const isNoSubscription = error instanceof ApiError && error.message === "no-subscription"
  if (isPending || error || isNoSubscription || !data) return null

  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#555]">
      <span className="flex items-center gap-1 rounded-full bg-[#F0F0F0] px-2 py-1">
        <Sparkles className="size-3" />
        {data.credits.used}/{data.credits.limit} credits
      </span>
    </div>
  )
}
