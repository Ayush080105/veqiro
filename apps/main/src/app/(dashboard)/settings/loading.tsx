import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-56 rounded-[var(--vq-r-sm)]" />
        <Skeleton className="h-4 w-full max-w-lg rounded-[var(--vq-r-sm)]" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-[var(--vq-r-sm)]" />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 rounded-[var(--vq-r)]" />
        <Skeleton className="h-36 rounded-[var(--vq-r)]" />
        <Skeleton className="h-36 rounded-[var(--vq-r)]" />
      </div>
    </div>
  )
}
