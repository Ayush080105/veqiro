import { Skeleton } from "@/components/ui/skeleton"

export default function BrainLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 rounded-md" />
        <Skeleton className="h-4 w-[28rem] max-w-full rounded-md" />
      </div>

      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 rounded-[var(--vq-r)]" />
        <Skeleton className="h-28 rounded-[var(--vq-r)]" />
        <Skeleton className="h-72 rounded-[var(--vq-r)]" />
        <Skeleton className="h-24 rounded-[var(--vq-r)]" />
      </div>
    </div>
  )
}
