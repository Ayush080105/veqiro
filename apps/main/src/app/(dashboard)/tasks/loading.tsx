import { Skeleton } from "@/components/ui/skeleton"

export default function TasksLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-4 w-[26rem] max-w-full rounded-md" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-56 rounded-md" />

      {/* Plays list */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  )
}
