"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MetricCardSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 14,
        boxShadow: "4px 4px 0 #111",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
