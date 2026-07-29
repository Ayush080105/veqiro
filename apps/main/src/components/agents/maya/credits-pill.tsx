"use client"

import { Info, Sparkles } from "lucide-react"

import { useMayaUsage } from "@/lib/api/billing"
import { isNoMayaSubscription } from "@/components/billing/entitlement-errors"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function MayaCreditsPill({ organizationId }: { organizationId: string }) {
  const { data, isPending, error } = useMayaUsage(organizationId)

  if (isPending || error || isNoMayaSubscription(error) || !data) return null

  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#555]">
      <span className="flex items-center gap-1 rounded-full bg-[#F0F0F0] px-2 py-1">
        <Sparkles className="size-3" />
        {data.credits.remaining} credits
      </span>
      <Popover>
        <PopoverTrigger
          className="flex items-center justify-center text-[#888] hover:text-[#555]"
          aria-label="Credit usage details"
          openOnHover
          closeDelay={150}
        >
          <Info className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="end">
          <p className="font-medium text-foreground">
            {data.credits.remaining} credits remaining this period
          </p>
          <p className="text-muted-foreground">
            1 image = 2 credits · 1 second of video = 4 credits. All
            image-generation types (campaign creator, regeneration,
            carousels, etc.) count toward this total.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
