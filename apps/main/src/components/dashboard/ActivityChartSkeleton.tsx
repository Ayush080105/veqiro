"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ActivityChartSkeleton() {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-[260px] w-full" />
    </div>
  )
}
