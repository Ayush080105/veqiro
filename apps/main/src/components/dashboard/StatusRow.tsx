"use client"

import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { useAgentStatuses } from "@/lib/api/assistants"
import { FONT } from "@/lib/fonts"
import type { AgentSlug, AgentStatus } from "@/lib/types"

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

export function StatusRow() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: statuses, isPending } = useAgentStatuses(organizationId)

  if (isPending) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[54px] w-[150px] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {AGENTS.map((agent) => {
        const agentStatus = statuses?.[agent.id as AgentSlug]
        const status: AgentStatus = agentStatus?.status ?? "idle"

        return (
          <Link
            key={agent.id}
            href={`/assistants/${agent.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px 8px 8px",
              background: "#FFF9ED",
              border: "2.5px solid #111",
              borderRadius: 12,
              boxShadow: "3px 3px 0 #111",
              textDecoration: "none",
              color: "#111",
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translate(2px,2px)"
              e.currentTarget.style.boxShadow = "1px 1px 0 #111"
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translate(0,0)"
              e.currentTarget.style.boxShadow = "3px 3px 0 #111"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(0,0)"
              e.currentTarget.style.boxShadow = "3px 3px 0 #111"
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: agent.color,
                border: "2px solid #111",
                display: "grid",
                placeItems: "center",
                fontFamily: FONT.head,
                fontSize: 11,
                color: "#111",
                flexShrink: 0,
              }}
            >
              {agent.initials}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontFamily: FONT.head,
                  fontSize: 12,
                  color: "#111",
                  lineHeight: 1,
                }}
              >
                {agent.name}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#555",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: statusDotColor(status),
                    flexShrink: 0,
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
