"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function MayaUsageCardSkeleton() {
  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-3">
        <div className="font-head text-2xl text-foreground">Credits</div>
        <p className="m-0 mt-1 text-xs text-muted-foreground">Maya image and video usage.</p>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
