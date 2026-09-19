"use client"

import { useRouter } from "next/navigation"

import type { AgentActionId } from "@/lib/types/agents"
import type { WorkListProps } from "@/lib/workspace/types"
import { LexDocumentsTab } from "@/components/agents/lex/documents-tab"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"
import { useWorkspaceChat } from "../../WorkspaceChatProvider"

/**
 * LexDocumentsTab as Lex's Work list, with no changes to the tab itself.
 *
 * The one real difference from the old page: which document is open is now a
 * URL, not component state, so a review is linkable and the back button does
 * what it looks like it should.
 */
export function LexDocumentsWork({ openObjectId }: WorkListProps) {
  const router = useRouter()
  const { hrefFor } = useAgentWorkspace()
  const { openAction } = useWorkspaceChat()

  return (
    <LexDocumentsTab
      onUpload={() => openAction("lex:upload-source" as AgentActionId)}
      onFollowUpAction={(actionId, prefill) =>
        openAction(actionId as AgentActionId, prefill)
      }
      openDocumentId={openObjectId ?? null}
      onOpenDocumentChange={(id) =>
        router.push(hrefFor("work", id ? `documents/${id}` : "documents"))
      }
    />
  )
}
