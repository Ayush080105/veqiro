"use client"

import dynamic from "next/dynamic"
import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { findAction } from "@/lib/agents/actions"
import { isPromptAction } from "@/lib/agents/prompt-actions"
import { WINDOW } from "@/lib/hooks/use-agent-chat"
import { qk } from "@/lib/query-keys"
import type { Message } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"
import type { ActionResultContext } from "@/components/chat/ActionDialog"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { useWorkspaceChat } from "./WorkspaceChatProvider"

const RunActionDialog = dynamic(() =>
  import("@/components/chat/RunActionDialog").then((m) => m.RunActionDialog),
)
const PromptActionDialog = dynamic(() =>
  import("./PromptActionDialog").then((m) => m.PromptActionDialog),
)
const ToolsMenu = dynamic(() =>
  import("@/components/chat/ToolsMenu").then((m) => m.ToolsMenu),
)

/**
 * Everything that opens over a workspace.
 *
 * Mounted from the layout beside the shell, so an action form survives module
 * navigation the same way the chat thread does — and so a result card lands in
 * the dock's thread whether it was started from Overview, from a work row or
 * from an insight's "do this" button.
 */
export function WorkspaceDialogs() {
  const { agent, config, organizationId } = useAgentWorkspace()
  const { chat, dialogs, openAction, setDockOpen } = useWorkspaceChat()
  const queryClient = useQueryClient()

  const { setMsgWindow, scrollIntentRef, isAtBottomRef, conversationId } = chat
  const {
    activeActionId,
    activePrefill,
    closeAction,
    setActionSubmitting,
    toolsOpen,
    setToolsOpen,
  } = dialogs

  /** Optimistically show what was asked for, before the result comes back. */
  const handleActionStart = useCallback(
    (ctx: { actionId: AgentActionId; input: unknown }) => {
      const meta = findAction(ctx.actionId)
      const userMsg: Message = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: meta?.label ?? "Action",
        imageUrl: null,
        createdAt: new Date().toISOString(),
      }
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, userMsg].slice(-WINDOW))
    },
    [setMsgWindow, scrollIntentRef],
  )

  /**
   * Append the result card.
   *
   * Only the generic path lives here. Maya's regenerate/variant enrichments in
   * the old page rewrite earlier messages rather than appending, which is
   * genuinely agent-specific; that moves onto the spec when Maya migrates
   * rather than being ported early and left unused.
   */
  const handleActionComplete = useCallback(
    (ctx: ActionResultContext<unknown, unknown>) => {
      const meta = findAction(ctx.actionId)

      // An action almost always changed something the workspace is showing.
      const agentPrefix = ctx.actionId.split(":")[0]
      void queryClient.invalidateQueries({ queryKey: [agentPrefix] })
      void queryClient.invalidateQueries({
        queryKey: qk.workspaceOverview(agent, organizationId),
      })
      void queryClient.invalidateQueries({ queryKey: ["workspace", "work", agent] })

      const assistantMsg: Message = {
        role: "assistant",
        content: meta ? `${meta.label} — done.` : "Action complete.",
        imageUrl: null,
        createdAt: new Date().toISOString(),
        customInput: { actionId: ctx.actionId, input: ctx.input, result: ctx.result },
      }
      if (isAtBottomRef.current) scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, assistantMsg].slice(-WINDOW))
      toast.success(meta ? `${meta.label} complete.` : "Action complete.")
    },
    [agent, organizationId, queryClient, setMsgWindow, scrollIntentRef, isAtBottomRef],
  )

  return (
    <>
      {toolsOpen && (
        <ToolsMenu
          open
          onOpenChange={setToolsOpen}
          agentSlug={agent}
          agentName={config.name}
          onPick={(a) => openAction(a.id)}
        />
      )}

      {isPromptAction(activeActionId) && (
        <PromptActionDialog
          key={activeActionId}
          actionId={activeActionId}
          prefill={activePrefill}
          onClose={closeAction}
          onSubmit={(prompt) => {
            closeAction()
            // Reveal the thread first: the reply is the point, and a send into
            // a closed dock looks like nothing happened.
            setDockOpen(true)
            void chat.sendText(prompt)
          }}
        />
      )}

      {activeActionId && !isPromptAction(activeActionId) && (
        <RunActionDialog
          open
          onOpenChange={(v) => {
            if (!v) closeAction()
          }}
          actionId={activeActionId}
          organizationId={organizationId}
          conversationId={conversationId}
          prefill={activePrefill}
          onStart={handleActionStart}
          onComplete={handleActionComplete}
          onSubmittingChange={setActionSubmitting}
        />
      )}
    </>
  )
}
