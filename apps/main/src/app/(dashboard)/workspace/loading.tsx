import { Skeleton } from "@/components/ui/skeleton"

export default function WorkspaceLoading() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-56 rounded-md" />

      {/* Table */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
      </div>
    </div>
  )
}
