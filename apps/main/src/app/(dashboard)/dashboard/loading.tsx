import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Hero skeleton - kicker, title, subtitle */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-48 rounded-md" />
        <Skeleton className="h-10 w-[60%] max-w-md rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>

      {/* Metrics strip */}
      <section className="flex flex-col gap-3">
        <Skeleton className="h-3 w-28 rounded-md" />
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </section>

      {/* Activity chart */}
      <Skeleton className="h-72 rounded-lg" />

      {/* Crew leaderboard + workspace snapshot */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-lg" />
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      </div>

      {/* Content pipeline */}
      <Skeleton className="h-56 rounded-lg" />

      {/* Daily briefing */}
      <Skeleton className="h-20 rounded-md" />
    </div>
  )
}
