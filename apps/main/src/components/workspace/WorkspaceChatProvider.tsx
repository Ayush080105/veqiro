"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAgentChat, type UseAgentChatResult } from "@/lib/hooks/use-agent-chat"
import {
  useAgentActionDialogs,
  type UseAgentActionDialogsResult,
} from "@/lib/hooks/use-agent-action-dialogs"
import type { AgentActionId } from "@/lib/types/agents"
import { useDockOpen } from "@/lib/workspace/dock-store"
import { useAgentWorkspace } from "./AgentWorkspaceContext"

interface WorkspaceChatValue {
  chat: UseAgentChatResult
  dialogs: UseAgentActionDialogsResult
  /** Open an action's form. The single entry point every module uses. */
  openAction: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
  /** Put a prompt in the composer and reveal the dock. */
  sendPrompt: (prompt: string) => void
  dockOpen: boolean
  setDockOpen: (open: boolean) => void
  toggleDock: () => void
}

const Ctx = createContext<WorkspaceChatValue | null>(null)

/**
 * Owns the chat thread and every dialog that opens over a workspace.
 *
 * THIS MUST BE MOUNTED FROM THE AGENT LAYOUT, not from a page. The App Router
 * keeps a layout's React instance alive while its own dynamic segments are
 * unchanged, so `[agent]` changing remounts (a different conversation, which is
 * correct) while overview → work → actions does not. That is the entire
 * mechanism behind the dock keeping its draft, scroll position and in-flight
 * stream across module navigation — there is no extra machinery.
 *
 * Four ways to break it, all of them silent:
 *   1. moving these hooks into a page.tsx,
 *   2. adding loading.tsx at the [agent] level (its Suspense boundary
 *      re-suspends this subtree; per-module loading.tsx is fine),
 *   3. adding template.tsx anywhere under workspace/ — templates remount by
 *      definition,
 *   4. a changing `key` above this in the tree.
 */
export function WorkspaceChatProvider({ children }: { children: ReactNode }) {
  const { agent, config, organizationId } = useAgentWorkspace()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dockOpen, setDockOpen] = useDockOpen(agent)

  // Only fetch history for a dock that is actually showing. Mounting here is
  // what makes the thread survive module navigation, but it also means this
  // runs on entering any module — so a customer who keeps the dock shut should
  // not pay for a chat fetch on every click.
  const chat = useAgentChat(agent, organizationId, config.name, { active: dockOpen })

  const dialogs = useAgentActionDialogs(agent, router, searchParams, {
    hrefForAgent: (slug, query) => `/workspace/${slug}/chat?${query}`,
    // Clean the ?action= off whatever module the customer is on, rather than
    // bouncing them to overview mid-task.
    selfHref: pathname,
  })

  const { openAction: openActionDialog } = dialogs
  const { setContent, setAttachedSourceIds } = chat

  const sendPrompt = useCallback(
    (prompt: string) => {
      setContent(prompt)
      setDockOpen(true)
    },
    [setContent, setDockOpen],
  )

  /**
   * "lex:ask-about" isn't a dialog — it attaches the document to the composer
   * (so the chat answer is grounded in its full text) and pre-fills a
   * question, then reveals the dock. Everything else opens its action dialog
   * as normal. Ported from the old chat page's handleAgentFollowUp, which
   * intercepted this the same way before RunActionDialog ever saw it;
   * RunActionDialog still deliberately excludes "lex:ask-about" from its
   * SPECS and renders nothing for it, so without this wrapper the button is
   * silently dead.
   */
  const openAction = useCallback(
    (actionId: AgentActionId, prefill?: Record<string, unknown>) => {
      if (actionId === "lex:ask-about") {
        const sourceId = typeof prefill?.sourceId === "string" ? prefill.sourceId : ""
        if (sourceId) {
          setAttachedSourceIds((prev) => (prev.includes(sourceId) ? prev : [...prev, sourceId]))
        }
        setContent(typeof prefill?.prompt === "string" ? prefill.prompt : "")
        setDockOpen(true)
        return
      }
      openActionDialog(actionId, prefill)
    },
    [openActionDialog, setAttachedSourceIds, setContent, setDockOpen],
  )

  // Dev-only guard for the failure mode above. A second mount for the same
  // agent means the layout boundary has been broken and every draft is being
  // silently thrown away on navigation — loud in dev beats discovered in prod.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const key = `__vqWorkspaceChatMounted_${agent}`
    const w = window as unknown as Record<string, number | undefined>
    w[key] = (w[key] ?? 0) + 1
    if (w[key]! > 1 && !mountedRef.current) {
      console.error(
        `[workspace] WorkspaceChatProvider mounted ${w[key]} times for "${agent}". ` +
          `Chat state is being lost on navigation. Check for a loading.tsx or ` +
          `template.tsx under app/(workspace)/workspace/[agent]/, or a changing key.`,
      )
    }
    mountedRef.current = true
    return () => {
      w[key] = (w[key] ?? 1) - 1
    }
  }, [agent])

  const value = useMemo<WorkspaceChatValue>(
    () => ({
      chat,
      dialogs,
      openAction,
      sendPrompt,
      dockOpen,
      setDockOpen,
      toggleDock: () => setDockOpen(!dockOpen),
    }),
    [chat, dialogs, openAction, sendPrompt, dockOpen, setDockOpen],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspaceChat(): WorkspaceChatValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error("useWorkspaceChat must be used inside a workspace layout")
  }
  return ctx
}
