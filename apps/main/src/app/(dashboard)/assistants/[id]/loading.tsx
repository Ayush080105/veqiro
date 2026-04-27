import { Skeleton } from "@/components/ui/skeleton"

export default function AssistantChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Chat header */}
      <div
        className="flex items-center gap-3 border-b-[3px] border-foreground px-5 py-3"
        style={{ background: "#FFF9ED" }}
      >
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-3 w-44 rounded-md" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Message stream */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-6">
        <Skeleton className="h-12 w-3/5 self-start rounded-lg" />
        <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
        <Skeleton className="h-10 w-1/2 self-start rounded-lg" />
        <Skeleton className="h-20 w-3/5 self-end rounded-lg" />
      </div>

      {/* Composer */}
      <div className="border-t-[3px] border-foreground px-5 py-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}
