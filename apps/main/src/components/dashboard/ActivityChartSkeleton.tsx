"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ActivityChartSkeleton() {
  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-3.5 flex justify-between gap-2.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
      </div>
      <Skeleton className="h-65 w-full" />
    </div>
  )
}
