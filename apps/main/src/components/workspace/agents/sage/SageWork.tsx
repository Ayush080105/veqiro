"use client"

import type { AgentActionId } from "@/lib/types/agents"
import type { WorkListProps } from "@/lib/workspace/types"
import { SageSavedKeywordsTab } from "@/components/agents/sage/saved-keywords-tab"
import { useWorkspaceChat } from "../../WorkspaceChatProvider"

/**
 * Sage's saved keywords as a Work list.
 *
 * In the old page "Generate blog" jumped back to the chat tab and opened the
 * action there; in the workspace the dock never went away, so it just opens
 * the action with the keyword prefilled.
 */
export function SageKeywordsWork(_props: WorkListProps) {
  const { openAction } = useWorkspaceChat()

  return (
    <SageSavedKeywordsTab
      onGenerateBlog={(keyword) =>
        openAction("sage:generate-blog" as AgentActionId, {
          keyword: keyword.keyword,
          search_intent: keyword.searchIntent,
        })
      }
    />
  )
}
