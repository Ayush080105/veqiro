"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { useDockPlacement } from "@/lib/workspace/use-dock-placement"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import type { ModuleId } from "@/lib/workspace/types"
import { useAgentWorkspace } from "./AgentWorkspaceContext"

interface WorkspaceChatValue {
  chat: UseAgentChatResult
  dialogs: UseAgentActionDialogsResult
  /** Open an action's form. The single entry point every module uses. */
  openAction: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
  /** Put a prompt in the composer and reveal the dock. */
  sendPrompt: (prompt: string) => void
  /** The customer's saved preference for the docked column. */
  dockOpen: boolean
  setDockOpen: (open: boolean) => void
  toggleDock: () => void
  /**
   * Whether the docked column is actually on screen right now: preferred open,
   * not superseded by the full-page Chat module, and the viewport can hold it.
   * Derived rather than written back, so visiting the Chat page never
   * overwrites what the customer chose for the dock.
   */
  dockVisible: boolean
  /** Make the thread visible by whatever means this screen has: dock or page. */
  revealChat: () => void
  /** Chat as the main area (the Chat module). */
  expandChat: () => void
  /** Back to the module the customer came from, with the dock open. */
  collapseChat: () => void
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
  const { agent, config, organizationId, activeModule, hrefFor } = useAgentWorkspace()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dockOpen, setDockOpen] = useDockOpen(agent)
  const placement = useDockPlacement()

  const onChatPage = activeModule === "chat"
  const dockVisible = dockOpen && !onChatPage && placement !== "none"

  // Only fetch history for a thread that is actually showing — the dock, or the
  // Chat page. Mounting here is what makes the thread survive module
  // navigation, but it also means this runs on entering any module, so a
  // customer who keeps the dock shut should not pay for a chat fetch on every
  // click. (The gate used to be the saved dock preference alone, which the Chat
  // page then forced to "closed" — aborting the very fetch it needed.)
  //
  // Two guards keep the gate from thrashing the thread. `hydrated`: the server
  // snapshots of the dock stores assume a desktop, and on a phone that briefly
  // reads "visible" during hydration — a phantom fetch that is aborted at once.
  // Sticky: once the thread has been shown it stays loaded, so resizing the
  // window across a breakpoint or hopping between dock and page does not
  // re-run the initial load.
  const hydrated = useHydrated()
  const threadWanted = hydrated && (onChatPage || dockVisible)
  const [threadEverWanted, setThreadEverWanted] = useState(false)
  if (threadWanted && !threadEverWanted) setThreadEverWanted(true)
  const chat = useAgentChat(agent, organizationId, config.name, {
    active: threadEverWanted || threadWanted,
  })

  const dialogs = useAgentActionDialogs(agent, router, searchParams, {
    hrefForAgent: (slug, query) => `/workspace/${slug}/chat?${query}`,
    // Clean the ?action= off whatever module the customer is on, rather than
    // bouncing them to overview mid-task.
    selfHref: pathname,
  })

  const { openAction: openActionDialog } = dialogs
  const { setContent, setAttachedSourceIds } = chat

  /**
   * Show the thread. On a screen that can hold the dock that means opening it;
   * on one that cannot (below lg) the only place the thread exists is the Chat
   * page, so go there. Without this, "Ask about this document" and every
   * post-action "see the result" did nothing visible on a phone.
   */
  const revealChat = useCallback(() => {
    if (onChatPage) return
    if (placement === "none") router.push(hrefFor("chat"))
    else setDockOpen(true)
  }, [onChatPage, placement, router, hrefFor, setDockOpen])

  // Where "Dock chat" returns to: the last module that was not Chat.
  const lastModuleRef = useRef<ModuleId>("overview")
  useEffect(() => {
    if (activeModule !== "chat") lastModuleRef.current = activeModule
  }, [activeModule])

  const expandChat = useCallback(() => router.push(hrefFor("chat")), [router, hrefFor])
  const collapseChat = useCallback(() => {
    setDockOpen(true)
    router.push(hrefFor(lastModuleRef.current))
  }, [router, hrefFor, setDockOpen])

  const sendPrompt = useCallback(
    (prompt: string) => {
      setContent(prompt)
      revealChat()
    },
    [setContent, revealChat],
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
        revealChat()
        return
      }
      openActionDialog(actionId, prefill)
    },
    [openActionDialog, setAttachedSourceIds, setContent, revealChat],
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
      dockVisible,
      revealChat,
      expandChat,
      collapseChat,
    }),
    [
      chat,
      dialogs,
      openAction,
      sendPrompt,
      dockOpen,
      setDockOpen,
      dockVisible,
      revealChat,
      expandChat,
      collapseChat,
    ],
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
