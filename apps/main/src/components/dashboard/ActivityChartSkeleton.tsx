"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ActivityChartSkeleton() {
  return (
    <div className="rounded-(--vq-r-lg) border border-(--vq-line-2) bg-card p-5 shadow-(--vq-shadow)">
      <div className="mb-3.5 flex justify-between gap-2.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-65 w-full" />
    </div>
  )
}
