import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutationState } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/client"
import { getMessages, useSendMessage, AgentNotAvailableError } from "@/lib/api/assistants"
import type { Message } from "@/lib/types"
import { applyCachedWindow,
  mergeMessageWindow,
  mergeServerSnapshot,
  parseCachedMessageWindow,
  setMessageDeliveryStatus,
} from "@/lib/chat/message-window"

export const WINDOW = 20

function genConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function chatCacheKey(orgId: string, agentId: string) {
  return `vq.chat.${orgId}.${agentId}`
}

/**
 * A still-streaming or not-yet-retried assistant placeholder has no
 * server-confirmed timestamp — its `createdAt` was stamped on the client the
 * instant the request started. A background refetch can bring back the
 * *real* row for the user message that placeholder is replying to with a
 * LATER server-recorded timestamp (the server writes it only after a network
 * round trip + DB work the placeholder didn't wait for), and mergeMessageWindow's
 * chronological sort will then — correctly, by its own logic — place the
 * reply before the message it's replying to. Refreshing the placeholder's
 * timestamp to "now" right before any merge against freshly-fetched server
 * rows keeps it sorted after everything that's actually been confirmed so
 * far, which is where an unresolved, still-open turn belongs.
 */
function refreshLocalPlaceholderTimestamps(messages: Message[]): Message[] {
  const isLivePlaceholder = (m: Message) =>
    m.role === "assistant" &&
    (m.deliveryStatus === "streaming" || m.deliveryStatus === "failed") &&
    (m.id?.startsWith("optimistic-") ?? false)
  if (!messages.some(isLivePlaceholder)) return messages
  const now = new Date().toISOString()
  return messages.map((m) => (isLivePlaceholder(m) ? { ...m, createdAt: now } : m))
}

/**
 * Message-window (fetch/paginate/cache) and send-flow (mutation + reconcile)
 * state for one agent's chat, shared by the plain chat surface and by
 * per-agent action dialogs that append to the same window. Scroll restoration
 * and agent-action-specific message patching stay in the caller — this hook
 * only owns what's needed to load, page, and send into `msgWindow`.
 */
/**
 * @param options.active Whether the thread is actually being shown. The
 *   workspace mounts this hook in the agent layout so chat state survives
 *   module navigation, which means it would otherwise fetch history on entering
 *   any module even with the dock collapsed. Gating only the initial load keeps
 *   that cost proportional to what the customer is looking at; everything else
 *   (drafts, the window, scroll position) stays alive either way. Defaults to
 *   true so the existing chat page is unaffected.
 */
export function useAgentChat(
  agentId: string,
  organizationId: string,
  agentName?: string,
  options?: { active?: boolean },
) {
  const active = options?.active ?? true
  const [msgWindow, setMsgWindow] = useState<Message[]>([])
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [isLoadingPrev, setIsLoadingPrev] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [fetchError, setFetchError] = useState<ApiError | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [content, setContent] = useState("")
  const [sendError, setSendError] = useState<ApiError | null>(null)
  // Lex-only: sources attached via the composer's "#" picker for the next send.
  const [attachedSourceIds, setAttachedSourceIds] = useState<string[]>([])
  // Set while viewing a page anchored around a pinned/searched message
  // instead of the live tail — background catch-up refetches must not
  // clobber it, and the composer returns to the tail before sending.
  const [isAnchored, setIsAnchored] = useState(false)
  const isAnchoredRef = useRef(false)
  isAnchoredRef.current = isAnchored
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  const conversationIdRef = useRef<string>(genConversationId())
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const scrollAnchorRef = useRef<number | null>(null)
  const scrollIntentRef = useRef<"instant" | "smooth" | null>("instant")
  const thisMutationRef = useRef(false)
  const prevMutationStatusRef = useRef<string | undefined>(undefined)
  const didCatchUpRef = useRef(false)
  // Which thread the last history load was for (null before the first). If the
  // effect re-runs for the same thread it is only because the thread became
  // visible (`active`), and whatever is on screen must not be wiped.
  const loadedKeyRef = useRef<string | null>(null)
  const isAtBottomRef = useRef(isAtBottom)
  const activeChatKey = `${organizationId}:${agentId}`
  const activeChatKeyRef = useRef(activeChatKey)
  activeChatKeyRef.current = activeChatKey
  isAtBottomRef.current = isAtBottom

  useEffect(() => {
    if (!agentId || !organizationId || !active) return
    const requestKey = `${organizationId}:${agentId}`
    // Only a change of thread identity resets the window. The first ever load
    // (null) has nothing to reset — and anything on screen by then is local
    // (an optimistic send made just before the thread became visible).
    const sameThread = loadedKeyRef.current === null || loadedKeyRef.current === requestKey
    loadedKeyRef.current = requestKey
    const controller = new AbortController()
    setFetchError(null)
    setIsLoadingPrev(false)
    didCatchUpRef.current = false
    thisMutationRef.current = false
    prevMutationStatusRef.current = undefined
    isAnchoredRef.current = false
    setIsAnchored(false)
    setHighlightedMessageId(null)

    // Paint instantly from localStorage cache (stale-while-revalidate)
    try {
      const raw = localStorage.getItem(chatCacheKey(organizationId, agentId))
      if (raw) {
        const cached = parseCachedMessageWindow(raw, WINDOW)
        if (cached.length > 0) {
          scrollIntentRef.current = "instant"
          setMsgWindow((current) => applyCachedWindow(current, cached, sameThread, WINDOW))
          setHasPreviousPage(cached.length === WINDOW)
          setInitialLoaded(true)
        } else if (!sameThread) {
          setInitialLoaded(false)
          setMsgWindow([])
        }
      } else if (!sameThread) {
        setInitialLoaded(false)
        setMsgWindow([])
      }
    } catch {
      if (!sameThread) {
        setInitialLoaded(false)
        setMsgWindow([])
      }
    }

    // Refresh from server in background
    getMessages(agentId, organizationId, undefined, controller.signal)
      .then((msgs) => {
        if (controller.signal.aborted || activeChatKeyRef.current !== requestKey) return
        scrollIntentRef.current = "instant"
        setMsgWindow((current) => mergeServerSnapshot(refreshLocalPlaceholderTimestamps(current), msgs, WINDOW))
        setHasPreviousPage(msgs.length === WINDOW)
        setInitialLoaded(true)
      })
      .catch((err) => {
        if (controller.signal.aborted || activeChatKeyRef.current !== requestKey) return
        if (err instanceof ApiError) setFetchError(err)
        setInitialLoaded(true)
      })

    return () => controller.abort()
    // `active` participates: flipping it false→true is what triggers the first
    // load for a dock the customer opened after landing on another module.
  }, [agentId, organizationId, active])

  // Persist window to localStorage after every settled update
  useEffect(() => {
    if (!initialLoaded || !agentId || !organizationId || msgWindow.length === 0) return
    // Anchored views are a slice of history, not the tail — caching them would
    // paint the wrong page on next load.
    if (isAnchored) return
    try {
      localStorage.setItem(
        chatCacheKey(organizationId, agentId),
        JSON.stringify(msgWindow.slice(-WINDOW)),
      )
    } catch {}
  }, [msgWindow, initialLoaded, agentId, organizationId, isAnchored])

  const loadPreviousPage = useCallback(async () => {
    if (!hasPreviousPage || isLoadingPrev) return
    const requestKey = `${organizationId}:${agentId}`
    setIsLoadingPrev(true)
    try {
      const oldest = msgWindow[0]?.createdAt
      const older = await getMessages(agentId, organizationId, oldest)
      if (activeChatKeyRef.current !== requestKey) return
      // Capture scrollHeight before the state update so useLayoutEffect can restore position
      scrollAnchorRef.current = chatScrollRef.current?.scrollHeight ?? 0
      setMsgWindow((current) => mergeMessageWindow(refreshLocalPlaceholderTimestamps(current), older))
      setHasPreviousPage(older.length === WINDOW)
    } finally {
      if (activeChatKeyRef.current === requestKey) setIsLoadingPrev(false)
    }
  }, [hasPreviousPage, isLoadingPrev, msgWindow, agentId, organizationId])

  const sendMutation = useSendMessage(agentId, organizationId, conversationIdRef.current, {
    onOptimistic: (optimistic, mutationChatKey) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      thisMutationRef.current = true
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, optimistic].slice(-WINDOW))
      setHasPreviousPage(true)
    },
    onAssistantStreaming: (placeholder, mutationChatKey) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, placeholder].slice(-WINDOW))
    },
    // `patch` always carries the full accumulated content/toolTrace (see
    // useSendMessage), so a shallow merge is correct here, not a delta apply.
    onStreamUpdate: (assistantId, mutationChatKey, patch) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      if (isAtBottomRef.current) scrollIntentRef.current = "instant"
      setMsgWindow((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)))
    },
    onSuccess: (serverMsg, optimisticId, mutationChatKey, assistantId) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => {
        // Drop the streaming placeholder explicitly by id rather than relying on
        // mergeMessageWindow's role/timing/content heuristic — a tool-heavy turn
        // can take well past its 15s optimistic-match window, which would leave
        // the placeholder stuck on screen instead of being reconciled away.
        const withoutPlaceholder = prev.filter((m) => m.id !== assistantId)

        // Append the reply and KEEP the user's message. This used to drop the last entry
        // before appending, on the assumption it was the optimistic message being replaced —
        // but the optimistic entry is the USER's message and serverMsg is the ASSISTANT's
        // reply, so the user's own message was deleted from the list the moment the bot
        // answered, and only came back on a refetch.
        const updated = mergeMessageWindow(
          refreshLocalPlaceholderTimestamps(setMessageDeliveryStatus(withoutPlaceholder, optimisticId, undefined)),
          [serverMsg],
          WINDOW,
        )

        // If the server updated an existing draft card image in-place, patch it
        // in React state so the user sees the new image without a page reload.
        const patchInfo = serverMsg.customInput?.result as Record<string, unknown> | undefined
        if (patchInfo?._modifyImagePatch === true) {
          const patchedId = patchInfo.patchedMessageId as string | undefined
          const newImage = patchInfo.image as { image_url: string; content_type: string; prompt_used: string } | undefined
          if (patchedId && newImage) {
            for (let i = 0; i < updated.length - 1; i++) {
              if (updated[i].id === patchedId) {
                const ci = updated[i].customInput
                const result = (ci?.result as Record<string, unknown>) ?? {}
                updated[i] = {
                  ...updated[i],
                  imageUrl: newImage.image_url,
                  customInput: ci ? { ...ci, result: { ...result, image: newImage } } : ci,
                }
                break
              }
            }
          }
        }

        return updated.slice(-WINDOW)
      })
    },
    onError: (optimisticId, mutationChatKey) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      setMsgWindow((prev) => setMessageDeliveryStatus(prev, optimisticId, "failed"))
    },
    onAssistantError: (assistantId, mutationChatKey) => {
      if (activeChatKeyRef.current !== mutationChatKey) return
      setMsgWindow((prev) =>
        prev.flatMap((m) => {
          if (m.id !== assistantId) return [m]
          // No tokens ever arrived — nothing to show, nothing to retry (only
          // the user's own message is restorable). Drop it rather than leave
          // a permanently blank "reply interrupted" bubble behind.
          if (!m.content.trim()) return []
          return [{ ...m, deliveryStatus: "failed" }]
        }),
      )
    },
  })

  // useMutationState survives navigation (lives on QueryClient, not the component).
  // This keeps the typing indicator visible when you switch agents and come back.
  const pendingCount = useMutationState({
    filters: { mutationKey: ["sendMessage", agentId, organizationId], status: "pending" },
  }).length
  const mutationStatuses = useMutationState({
    filters: { mutationKey: ["sendMessage", agentId, organizationId] },
    select: (m) => m.state.status,
  })
  const latestMutationStatus = mutationStatuses[mutationStatuses.length - 1]
  // Ref to read latest mutation status from event listeners without stale closures
  const latestMutationStatusRef = useRef(latestMutationStatus)
  latestMutationStatusRef.current = latestMutationStatus // Keep updated on every render

  // The three catch-up refetches below (orphaned mutation, tab-visibility,
  // belt-and-suspenders) only know a send *finished* — not which local
  // assistant placeholder it belongs to. Without this, a placeholder that's
  // still "streaming" (or was marked "failed" by a transient client-side
  // stream-read error even though the server did persist a reply) survives
  // the merge indefinitely, since mergeMessageWindow only adds messages, it
  // doesn't retire stale local-only ones. onSuccess already does this precise
  // cleanup by id for the component that owns the mutation; mirror it here so
  // catch-up paths can too.
  const successAssistantIds = useMutationState({
    filters: { mutationKey: ["sendMessage", agentId, organizationId], status: "success" },
    select: (m) => (m.state.data as { assistantId?: string } | undefined)?.assistantId,
  })
  const latestSuccessAssistantIdRef = useRef<string | undefined>(undefined)
  latestSuccessAssistantIdRef.current = successAssistantIds[successAssistantIds.length - 1]

  const pruneStaleAssistantPlaceholder = useCallback((messages: Message[]) => {
    const id = latestSuccessAssistantIdRef.current
    return id ? messages.filter((m) => m.id !== id) : messages
  }, [])
  const isLoading = pendingCount > 0 || sendMutation.isPending
  const historyLoaded = initialLoaded

  // When a sendMessage mutation completes after the user navigated away and back,
  // onSuccess fired on the old (unmounted) component and was a no-op. Detect that
  // transition here and re-fetch messages so the AI response appears without a refresh.
  useEffect(() => {
    const prev = prevMutationStatusRef.current
    prevMutationStatusRef.current = latestMutationStatus

    if (prev !== "pending" || latestMutationStatus !== "success") return

    if (thisMutationRef.current) {
      // This component instance sent the mutation; onSuccess already updated msgWindow.
      thisMutationRef.current = false
      return
    }

    // Orphaned mutation — re-fetch so the result and tool cards appear.
    // Skip while anchored to a pinned/searched page — that view isn't the
    // tail, and the fetched "latest" page would silently replace it.
    if (isAnchoredRef.current) return
    const requestKey = `${organizationId}:${agentId}`
    const controller = new AbortController()
    getMessages(agentId, organizationId, undefined, controller.signal)
      .then((msgs) => {
        if (controller.signal.aborted || activeChatKeyRef.current !== requestKey) return
        scrollIntentRef.current = "smooth"
        setMsgWindow((current) =>
          mergeMessageWindow(refreshLocalPlaceholderTimestamps(pruneStaleAssistantPlaceholder(current)), msgs),
        )
        setHasPreviousPage(msgs.length === WINDOW)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [latestMutationStatus, agentId, organizationId, pruneStaleAssistantPlaceholder])

  // Refetch when user returns to this tab — covers the "agent finished while on
  // another tab" case. React Query has refetchOnWindowFocus disabled globally,
  // so this targeted listener handles only the chat message list.
  useEffect(() => {
    let controller: AbortController | null = null
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      const status = latestMutationStatusRef.current
      if (status !== "pending" && status !== "success") return
      if (isAnchoredRef.current) return
      const requestKey = `${organizationId}:${agentId}`
      controller?.abort()
      const requestController = new AbortController()
      controller = requestController
      getMessages(agentId, organizationId, undefined, requestController.signal)
        .then((msgs) => {
          if (requestController.signal.aborted || activeChatKeyRef.current !== requestKey) return
          setMsgWindow((current) =>
            mergeMessageWindow(refreshLocalPlaceholderTimestamps(pruneStaleAssistantPlaceholder(current)), msgs),
          )
          setHasPreviousPage(msgs.length === WINDOW)
        })
        .catch(() => {})
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      controller?.abort()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [agentId, organizationId]) // Only re-register when agent changes, not on every status change

  // If a mutation for this agent completed before this component mounted, the
  // orphaned detection can't catch it (no pending→success transition seen).
  // After initialLoaded settles, do one additional fetch as belt-and-suspenders.
  useEffect(() => {
    if (!initialLoaded || didCatchUpRef.current) return
    if (latestMutationStatus !== "success" || mutationStatuses.length === 0) return
    if (isAnchoredRef.current) return
    didCatchUpRef.current = true
    const requestKey = `${organizationId}:${agentId}`
    const controller = new AbortController()
    getMessages(agentId, organizationId, undefined, controller.signal)
      .then((msgs) => {
        if (controller.signal.aborted || activeChatKeyRef.current !== requestKey) return
        setMsgWindow((current) =>
          mergeMessageWindow(refreshLocalPlaceholderTimestamps(pruneStaleAssistantPlaceholder(current)), msgs),
        )
        setHasPreviousPage(msgs.length === WINDOW)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [initialLoaded, latestMutationStatus, mutationStatuses.length, agentId, organizationId, pruneStaleAssistantPlaceholder])

  const msgWindowRef = useRef(msgWindow)
  msgWindowRef.current = msgWindow

  /** Jump to a pinned/searched message: highlight it in place if it's already
   * loaded, otherwise fetch a page anchored to end just after it (the server
   * always returns the `limit` most-recent rows before a cursor, so the
   * target lands as the last row with up to WINDOW-1 rows of lead-up). */
  const jumpToMessage = useCallback(async (id: string, createdAt: string) => {
    if (msgWindowRef.current.some((m) => m.id === id)) {
      setHighlightedMessageId(id)
      return
    }
    const requestKey = `${organizationId}:${agentId}`
    try {
      const cursor = new Date(new Date(createdAt).getTime() + 1).toISOString()
      const page = await getMessages(agentId, organizationId, cursor)
      if (activeChatKeyRef.current !== requestKey) return
      isAnchoredRef.current = true
      setIsAnchored(true)
      // No scrollIntentRef here — the page's render effect scrollIntoView's
      // the highlighted target directly, which is more precise than the
      // scroll-to-bottom heuristic that ref otherwise drives.
      setMsgWindow(page)
      setHasPreviousPage(page.length === WINDOW)
      setHighlightedMessageId(id)
    } catch {
      toast.error("Couldn't jump to that message.")
    }
  }, [agentId, organizationId])

  const returnToLatest = useCallback(async () => {
    const requestKey = `${organizationId}:${agentId}`
    try {
      const msgs = await getMessages(agentId, organizationId, undefined)
      if (activeChatKeyRef.current !== requestKey) return
      isAnchoredRef.current = false
      setIsAnchored(false)
      setHighlightedMessageId(null)
      scrollIntentRef.current = "smooth"
      setMsgWindow((current) => mergeServerSnapshot(refreshLocalPlaceholderTimestamps(current), msgs, WINDOW))
      setHasPreviousPage(msgs.length === WINDOW)
    } catch {
      toast.error("Couldn't return to the latest messages.")
    }
  }, [agentId, organizationId])

  const clearHighlight = useCallback(() => setHighlightedMessageId(null), [])

  /** Send explicit text, bypassing the composer — for actions that build the request themselves. */
  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 1000 || isLoading) return

    if (isAnchoredRef.current) await returnToLatest()

    setContent("")
    const sourceIds = attachedSourceIds
    setAttachedSourceIds([])
    try {
      await sendMutation.mutateAsync({ content: trimmed, sourceIds: sourceIds.length ? sourceIds : undefined })
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setSendError(err)
      } else if (err instanceof AgentNotAvailableError) {
        toast.error(
          `${agentName ?? "This agent"} isn't connected yet — backend route is being set up. Try again soon.`
        )
      } else {
        toast.error("Failed to send message. Please try again.")
      }
    }
  }, [isLoading, sendMutation, agentName, attachedSourceIds, returnToLatest])

  const handleSend = useCallback(() => sendText(content), [sendText, content])

  const contentRef = useRef(content)
  contentRef.current = content
  const handleRestoreDraft = useCallback((message: Message) => {
    if (message.deliveryStatus !== "failed") return
    if (contentRef.current.trim()) {
      toast.info("The composer already has a draft. Send or clear it before restoring this message.")
      return
    }
    setContent(message.content)
    toast.info("Message restored. Review it, then press Send to retry.")
  }, [])

  return useMemo(
    () => ({
      msgWindow,
      setMsgWindow,
      hasPreviousPage,
      isLoadingPrev,
      historyLoaded,
      fetchError,
      isAtBottom,
      setIsAtBottom,
      isAtBottomRef,
      loadPreviousPage,
      content,
      setContent,
      sendError,
      isLoading,
      handleSend,
      sendText,
      handleRestoreDraft,
      // The id itself, not only the ref. It is fixed for the life of the hook,
      // so consumers that just need the value should not have to read .current
      // during render and trip the refs lint rule for nothing.
      conversationId: conversationIdRef.current,
      conversationIdRef,
      chatScrollRef,
      scrollAnchorRef,
      scrollIntentRef,
      attachedSourceIds,
      setAttachedSourceIds,
      isAnchored,
      highlightedMessageId,
      jumpToMessage,
      returnToLatest,
      clearHighlight,
    }),
    [
      msgWindow,
      hasPreviousPage,
      isLoadingPrev,
      historyLoaded,
      fetchError,
      isAtBottom,
      loadPreviousPage,
      content,
      sendError,
      isLoading,
      handleSend,
      sendText,
      handleRestoreDraft,
      attachedSourceIds,
      isAnchored,
      highlightedMessageId,
      jumpToMessage,
      returnToLatest,
      clearHighlight,
    ],
  )
}

export type UseAgentChatResult = ReturnType<typeof useAgentChat>
