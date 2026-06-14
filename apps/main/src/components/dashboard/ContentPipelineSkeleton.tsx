"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ContentPipelineSkeleton() {
  return (
    <div
      style={{
        background: "#D5CCBA",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-48 w-48 self-center rounded-full" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
