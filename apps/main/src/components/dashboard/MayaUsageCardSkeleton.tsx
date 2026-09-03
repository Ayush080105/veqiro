"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MayaUsageCardSkeleton() {
  return (
    <div className="bg-card border border-[var(--vq-line-2)] rounded-2xl shadow-[var(--vq-shadow)] p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ maya - at a glance ]
      </div>
      <div className="font-display text-[26px] tracking-tight text-foreground mt-0.5 mb-3">
        credits
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
