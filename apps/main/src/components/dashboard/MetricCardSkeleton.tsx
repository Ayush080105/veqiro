"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MetricCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--vq-r)] border border-border bg-card p-4.5 shadow-[var(--vq-shadow-sm)]">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
