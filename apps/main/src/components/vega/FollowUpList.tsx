"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchFollowUps, cancelFollowUp } from "@/lib/api/vega-followups"
import { qk } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, X } from "lucide-react"
import { toast } from "sonner"

const statusConfig = {
  PENDING: { label: "Pending", color: "#F5C518" },
  SENT: { label: "Sent", color: "#1DBC87" },
  CANCELLED: { label: "Cancelled", color: "#999" },
  OVERDUE: { label: "Overdue", color: "#F06464" },
}

function formatDueAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function FollowUpList() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const { data: followUps, isLoading } = useQuery({
    queryKey: qk.vegaFollowUps(organizationId),
    queryFn: fetchFollowUps,
    enabled: !!organizationId,
  })

  const cancel = useMutation({
    mutationFn: cancelFollowUp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.vegaFollowUps(organizationId) })
      toast.success("Follow-up cancelled")
    },
    onError: () => toast.error("Failed to cancel follow-up"),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!followUps?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Clock className="size-8 opacity-30" />
        <p className="text-sm">No follow-ups scheduled</p>
        <p className="text-xs">Select an email and choose &ldquo;Follow-up Later&rdquo; to add one.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {followUps.map((f) => {
        const cfg = statusConfig[f.status]
        return (
          <div
            key={f.id}
            style={{
              border: "2px solid #E5E5E5",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold truncate">{f.emailSubject}</span>
                <span className="text-[11px] text-muted-foreground">{f.senderEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  style={{
                    background: "transparent",
                    color: cfg.color,
                    border: `1px solid ${cfg.color}`,
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {cfg.label}
                </Badge>
                {f.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => cancel.mutate(f.id)}
                    disabled={cancel.isPending}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="size-3" />
              Due: {formatDueAt(f.dueAt)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
