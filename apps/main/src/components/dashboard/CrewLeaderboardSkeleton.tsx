"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function CrewLeaderboardSkeleton() {
  return (
    <div
      style={{
        background: "#D5CCBA",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-7 w-44" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
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
