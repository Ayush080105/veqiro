"use client"

import { useRouter } from "next/navigation"

import { AGENT_PHOTOS } from "@/lib/config/agents"
import type { AgentActionId } from "@/lib/types/agents"
import type { OverviewWidgetProps } from "@/lib/workspace/types"
import { LexHome } from "@/components/agents/lex/home"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"
import { useWorkspaceChat } from "../../WorkspaceChatProvider"

/**
 * LexHome, unchanged, as the first widget on Lex's overview.
 *
 * This is the whole reason Lex was the pilot: the thing the customer already
 * knows — Legal Watch, the job cards, the recently-reviewed list — is the
 * first thing they see in the new workspace, so the move cannot feel like a
 * downgrade. All this adapter does is map LexHome's callbacks onto the
 * workspace's navigation and action entry points.
 */
export function LexOverviewWidget({ agent }: OverviewWidgetProps) {
  const router = useRouter()
  const { hrefFor } = useAgentWorkspace()
  const { openAction, sendPrompt } = useWorkspaceChat()

  return (
    <LexHome
      photo={AGENT_PHOTOS[agent]}
      onAction={(actionId: AgentActionId) => openAction(actionId)}
      onPrompt={sendPrompt}
      onOpenDocument={(sourceRowId) =>
        router.push(hrefFor("work", `documents/${sourceRowId}`))
      }
      onViewAll={() => router.push(hrefFor("work", "documents"))}
      embedded
    />
  )
}
