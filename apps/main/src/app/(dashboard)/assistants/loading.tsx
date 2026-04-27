import { Skeleton } from "@/components/ui/skeleton"

export default function AssistantsLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
    </div>
  )
}
