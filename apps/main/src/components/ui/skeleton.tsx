import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[var(--vq-r-sm)] bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
