"use client"

import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { useAgentStatuses } from "@/lib/api/assistants"
import { FONT } from "@/lib/fonts"
import type { AgentSlug, AgentStatus, AgentStatusData } from "@/lib/types"

function statusDotColor(status: AgentStatus): string {
  if (status === "working") return "#1DBC87"
  if (status === "needs-attention") return "#F06464"
  return "#F5C518"
}

function statusLabel(status: AgentStatus): string {
  if (status === "working") return "working"
  if (status === "needs-attention") return "needs attention"
  return "idle"
}

type StatusRowProps = {
  statuses?: Record<AgentSlug, AgentStatusData>
  isPending?: boolean
}

export function StatusRow({
  statuses: providedStatuses,
  isPending: providedIsPending,
}: StatusRowProps = {}) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = providedStatuses ? "" : activeOrg?.id ?? ""
  const { data: fetchedStatuses, isPending: fetchedIsPending } =
    useAgentStatuses(organizationId)
  const statuses = providedStatuses ?? fetchedStatuses
  const isPending = providedIsPending ?? (!providedStatuses && fetchedIsPending)

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[58px] rounded-md border border-[var(--vq-line-2)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
      {AGENTS.map((agent) => {
        const agentStatus = statuses?.[agent.id as AgentSlug]
        const status: AgentStatus = agentStatus?.status ?? "idle"

        return (
          <Link
            key={agent.id}
            href={`/assistants/${agent.id}`}
            className="group flex min-h-[58px] min-w-0 items-center gap-2.5 rounded-md border border-[var(--vq-line-2)] bg-card p-2 pr-3 text-foreground no-underline shadow-[var(--vq-shadow-sm)] transition-[transform,box-shadow,background-color] duration-150 hover:bg-[#FFF9ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translate(2px,2px)"
              e.currentTarget.style.boxShadow = "1px 1px 0 var(--foreground)"
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translate(0,0)"
              e.currentTarget.style.boxShadow = "3px 3px 0 var(--foreground)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0,0)"
              e.currentTarget.style.boxShadow = "3px 3px 0 var(--foreground)"
            }}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--vq-line-2)] text-foreground"
              style={{
                background: agent.color,
                fontFamily: FONT.head,
                fontSize: 11,
              }}
            >
              {agent.initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className="truncate text-foreground"
                style={{
                  fontFamily: FONT.head,
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {agent.name}
              </span>
              <span
                className="inline-flex items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                style={{
                  fontFamily: FONT.mono,
                }}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: statusDotColor(status),
                  }}
                />
                {statusLabel(status)}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
