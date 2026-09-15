import { Skeleton } from "@/components/ui/skeleton"

export default function WorkspaceLoading() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>

      <Skeleton className="h-9 w-56 rounded-md" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 rounded-[var(--vq-r)]" />
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
      </div>
    </div>
  )
}
