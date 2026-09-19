"use client"

import type { AgentActionId } from "@/lib/types/agents"
import type { OverviewWidgetProps, WorkListProps } from "@/lib/workspace/types"
import { RexDataTab } from "@/components/agents/rex/data-tab"
import { TodayPanel } from "@/components/agents/rex/today-panel"
import { useWorkspaceChat } from "../../WorkspaceChatProvider"

/**
 * Rex's dataset manager as a Work list, and his pinned numbers as an overview
 * widget. Both components are reused as they are — the only wiring needed is
 * pointing their callbacks at the workspace's action entry point and dock.
 */

export function RexDatasetsWork({ organizationId }: WorkListProps) {
  const { openAction, setDockOpen } = useWorkspaceChat()

  return (
    <RexDataTab
      organizationId={organizationId}
      onOpenAction={(actionId, prefill) =>
        openAction(actionId as AgentActionId, prefill)
      }
      // In the old page this switched tabs; here the thread is already beside
      // you, so it only has to be made visible.
      onSwitchToChat={() => setDockOpen(true)}
    />
  )
}

/**
 * The pinned-cards strip, which is the closest thing Rex has to "what is
 * happening" — so it leads his overview.
 */
export function RexTodayWidget({ organizationId }: OverviewWidgetProps) {
  return <TodayPanel organizationId={organizationId} />
}
