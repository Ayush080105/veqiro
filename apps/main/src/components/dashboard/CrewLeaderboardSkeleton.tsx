"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function CrewLeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-border bg-card p-4.5 shadow-[var(--vq-shadow-sm)]">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-7 w-44" />
      <div className="mt-1 flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
