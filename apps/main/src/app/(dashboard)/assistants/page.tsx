"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { getAssistantStatuses } from "@/lib/api/assistants"
import { AssistantCard } from "@/components/assistants/AssistantCard"
import { FONT, Sticker } from "@/components/veqiro/shared"
import type { AgentSlug, AgentStatus } from "@/lib/types"

interface AssistantStatusData {
  status: AgentStatus
  lastActivity: string
}

export default function AssistantsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const [statuses, setStatuses] = useState<Record<string, AssistantStatusData>>({})

  useEffect(() => {
    if (!organizationId) return
    getAssistantStatuses(organizationId).then((data) => {
      setStatuses(data as Record<AgentSlug, AssistantStatusData>)
    })
  }, [organizationId])

  return (
    <div
      style={{
        background: "#111",
        color: "#EFE7D6",
        margin: "-16px",
        padding: "56px 40px 80px",
        minHeight: "calc(100vh - 3rem)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 36,
        }}
      >
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: -28, left: -6 }}>
            <Sticker rot={-4} color="#F5C518">
              your crew
            </Sticker>
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#F5C518",
              marginBottom: 10,
            }}
          >
            [ THE TEAM ]
          </div>
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(48px, 6vw, 88px)",
              margin: 0,
              lineHeight: 0.9,
              letterSpacing: -1,
              color: "#EFE7D6",
            }}
          >
            six hires,{" "}
            <span style={{ color: "#F5C518" }}>one bill.</span>
          </h1>
        </div>
        <p
          style={{
            maxWidth: 380,
            fontFamily: FONT.body,
            fontSize: 16,
            lineHeight: 1.5,
            color: "#CFC6B2",
            margin: 0,
          }}
        >
          Each one has a specialty, a personality, and opinions about your
          brand voice. Click a card to put them to work.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 28,
        }}
      >
        {AGENTS.map((agent, i) => {
          const statusData = statuses[agent.id]
          return (
            <AssistantCard
              key={agent.id}
              agent={agent}
              status={statusData?.status}
              lastActivity={statusData?.lastActivity}
              index={i}
            />
          )
        })}
      </div>
    </div>
  )
}
