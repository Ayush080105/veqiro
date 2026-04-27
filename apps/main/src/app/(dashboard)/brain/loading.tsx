import { Skeleton } from "@/components/ui/skeleton"

export default function BrainLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Hero */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-10 w-72 rounded-md" />
        <Skeleton className="h-4 w-[28rem] max-w-full rounded-md" />
      </div>

      {/* Brand kit sections */}
      <div className="flex flex-col gap-6">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </div>
  )
}
