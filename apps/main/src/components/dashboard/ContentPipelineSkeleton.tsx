"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ContentPipelineSkeleton() {
  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
