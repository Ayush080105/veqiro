"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AGENTS } from "@/lib/config/agents"
import { getAssistantStatuses } from "@/lib/api/assistants"
import type { AgentSlug, AgentStatus, AgentStatusData } from "@/lib/types"

type StatusMap = Record<AgentSlug, AgentStatusData>

function statusDotClass(status: AgentStatus): string {
  if (status === "working") return "bg-chart-2"
  if (status === "needs-attention") return "bg-destructive"
  return "bg-chart-1"
}

function statusLabel(status: AgentStatus): string {
  if (status === "working") return "Working"
  if (status === "needs-attention") return "Needs attention"
  return "Idle"
}

export function StatusRow() {
  const [statuses, setStatuses] = useState<StatusMap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAssistantStatuses("")
      .then((data) => setStatuses(data as StatusMap))
      .catch(() => setStatuses(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-36 rounded-none" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {AGENTS.map((agent) => {
        const agentStatus = statuses?.[agent.id as AgentSlug]
        const status: AgentStatus = agentStatus?.status ?? "idle"

        return (
          <Link
            key={agent.id}
            href={`/assistants/${agent.id}`}
            className="flex items-center gap-2.5 rounded-none border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-muted"
          >
            <Avatar size="sm">
              <AvatarFallback
                className="text-xs font-medium"
                style={{ backgroundColor: `var(--${agent.color})`, color: "var(--primary-foreground)" }}
              >
                {agent.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground leading-none">
                {agent.name}
              </span>
              <div className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(status)}`}
                />
                <span className="text-muted-foreground leading-none">
                  {statusLabel(status)}
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
