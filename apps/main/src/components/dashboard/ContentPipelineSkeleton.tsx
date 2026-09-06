"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ContentPipelineSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 rounded-(--vq-r-lg) border border-(--vq-line-2) bg-card p-5 shadow-(--vq-shadow)">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-48 w-48 self-center rounded-full" />
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
