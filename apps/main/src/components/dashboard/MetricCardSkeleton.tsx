"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MetricCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-(--vq-r-lg) border border-(--vq-line-2) bg-card p-4.5 shadow-(--vq-shadow)">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
