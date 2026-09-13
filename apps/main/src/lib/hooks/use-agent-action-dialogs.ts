import { useCallback, useEffect, useState } from "react"
import type { AgentActionId } from "@/lib/types/agents"

interface RouterLike {
  push: (href: string) => void
  replace: (href: string) => void
}

interface SearchParamsLike {
  get: (key: string) => string | null
}

export interface UseAgentActionDialogsResult {
  toolsOpen: boolean
  setToolsOpen: (v: boolean) => void
  templatePickerOpen: boolean
  setTemplatePickerOpen: (v: boolean) => void
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  onboardOpen: boolean
  setOnboardOpen: (v: boolean) => void
  infoOpen: boolean
  setInfoOpen: (v: boolean) => void
  activeActionId: AgentActionId | null
  activePrefill: Record<string, unknown> | undefined
  actionSubmitting: boolean
  setActionSubmitting: (v: boolean) => void
  openAction: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
  closeAction: () => void
  handleFollowUp: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
}

/**
 * Owns every "something opened over the chat" boolean plus the action-dialog
 * payload (activeActionId/activePrefill) and its own ?action=/&prefill= deep
 * link, so that cluster doesn't have to be read in full every time something
 * unrelated in the chat page changes.
 *
 * Tab state (lexTab/sageTab/rexTab/mayaTab) deliberately stays in the page
 * component instead of here: several handlers there set a tab AND open an
 * action in the same call (e.g. switching back to "chat" before opening
 * lex:analyze-contract), and threading tab setters through this hook's API
 * for three call sites wasn't worth the extra indirection. pinnedOpen stays
 * too — it's a message-browsing panel, not an action dialog.
 */
export function useAgentActionDialogs(
  agentSlug: string,
  router: RouterLike,
  searchParams: SearchParamsLike,
): UseAgentActionDialogsResult {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)
  const [activePrefill, setActivePrefill] = useState<Record<string, unknown> | undefined>(undefined)
  const [actionSubmitting, setActionSubmitting] = useState(false)

  const openAction = useCallback((actionId: AgentActionId, prefill?: Record<string, unknown>) => {
    setActivePrefill(prefill)
    setActiveActionId(actionId)
  }, [])

  const closeAction = useCallback(() => {
    setActiveActionId(null)
    setActivePrefill(undefined)
  }, [])

  // Cross-agent handoff: navigate to the target agent's page with the action
  // pre-loaded. Same-agent follow-ups open the dialog inline as before.
  const handleFollowUp = useCallback(
    (actionId: AgentActionId, prefill?: Record<string, unknown>) => {
      const targetAgent = actionId.split(":")[0]
      if (targetAgent === agentSlug) {
        openAction(actionId, prefill)
      } else {
        const qs = new URLSearchParams({ action: actionId })
        if (prefill) qs.set("prefill", JSON.stringify(prefill))
        router.push(`/assistants/${targetAgent}?${qs.toString()}`)
      }
    },
    [agentSlug, openAction, router],
  )

  // On mount: if URL contains ?action=..., open that action dialog then clean the URL.
  useEffect(() => {
    const action = searchParams.get("action") as AgentActionId | null
    if (!action) return
    const prefillStr = searchParams.get("prefill")
    const prefill = prefillStr ? (JSON.parse(prefillStr) as Record<string, unknown>) : undefined
    openAction(action, prefill)
    router.replace(`/assistants/${agentSlug}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  return {
    toolsOpen,
    setToolsOpen,
    templatePickerOpen,
    setTemplatePickerOpen,
    helpOpen,
    setHelpOpen,
    onboardOpen,
    setOnboardOpen,
    infoOpen,
    setInfoOpen,
    activeActionId,
    activePrefill,
    actionSubmitting,
    setActionSubmitting,
    openAction,
    closeAction,
    handleFollowUp,
  }
}
