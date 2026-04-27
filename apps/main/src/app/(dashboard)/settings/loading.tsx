import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-28 rounded-md" />
        <Skeleton className="h-10 w-56 rounded-md" />
        <Skeleton className="h-4 w-80 rounded-md" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  )
}
