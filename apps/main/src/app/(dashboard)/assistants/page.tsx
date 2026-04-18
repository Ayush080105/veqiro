"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { getAssistantStatuses } from "@/lib/api/assistants"
import { AssistantCard } from "@/components/assistants/AssistantCard"
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Your AI Team</h1>
        <p className="text-sm text-muted-foreground">
          6 specialists working for you, around the clock.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => {
          const statusData = statuses[agent.id]
          return (
            <AssistantCard
              key={agent.id}
              agent={agent}
              status={statusData?.status}
              lastActivity={statusData?.lastActivity}
            />
          )
        })}
      </div>
    </div>
  )
}
