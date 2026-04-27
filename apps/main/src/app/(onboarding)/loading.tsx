import { Skeleton } from "@/components/ui/skeleton"

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen" style={{ background: "#EFE7D6" }}>
      {/* Header band */}
      <div className="flex items-center justify-between border-b-[3px] border-foreground bg-background px-8 py-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      <div className="mx-auto mt-8 max-w-2xl px-6">
        {/* Progress dashes */}
        <div className="mb-8 flex items-center gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1 rounded-full" />
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-3/5 rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
