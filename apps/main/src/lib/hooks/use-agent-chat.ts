import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutationState } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/client"
import { getMessages, useSendMessage, AgentNotAvailableError } from "@/lib/api/assistants"
import type { Message } from "@/lib/types"
import {
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
export function useAgentChat(agentId: string, organizationId: string, agentName?: string) {
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

  const conversationIdRef = useRef<string>(genConversationId())
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const scrollAnchorRef = useRef<number | null>(null)
  const scrollIntentRef = useRef<"instant" | "smooth" | null>("instant")
  const thisMutationRef = useRef(false)
  const prevMutationStatusRef = useRef<string | undefined>(undefined)
  const didCatchUpRef = useRef(false)
  const isAtBottomRef = useRef(isAtBottom)
  const activeChatKey = `${organizationId}:${agentId}`
  const activeChatKeyRef = useRef(activeChatKey)
  activeChatKeyRef.current = activeChatKey
  isAtBottomRef.current = isAtBottom

  useEffect(() => {
    if (!agentId || !organizationId) return
    const requestKey = `${organizationId}:${agentId}`
    const controller = new AbortController()
    setFetchError(null)
    setIsLoadingPrev(false)
    didCatchUpRef.current = false
    thisMutationRef.current = false
    prevMutationStatusRef.current = undefined

    // Paint instantly from localStorage cache (stale-while-revalidate)
    try {
      const raw = localStorage.getItem(chatCacheKey(organizationId, agentId))
      if (raw) {
        const cached = parseCachedMessageWindow(raw, WINDOW)
        if (cached.length > 0) {
          scrollIntentRef.current = "instant"
          setMsgWindow(cached)
          setHasPreviousPage(cached.length === WINDOW)
          setInitialLoaded(true)
        } else {
          setInitialLoaded(false)
          setMsgWindow([])
        }
      } else {
        setInitialLoaded(false)
        setMsgWindow([])
      }
    } catch {
      setInitialLoaded(false)
      setMsgWindow([])
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
  }, [agentId, organizationId])

  // Persist window to localStorage after every settled update
  useEffect(() => {
    if (!initialLoaded || !agentId || !organizationId || msgWindow.length === 0) return
    try {
      localStorage.setItem(
        chatCacheKey(organizationId, agentId),
        JSON.stringify(msgWindow.slice(-WINDOW)),
      )
    } catch {}
  }, [msgWindow, initialLoaded, agentId, organizationId])

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

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 1000 || isLoading) return

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
  }, [content, isLoading, sendMutation, agentName, attachedSourceIds])

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
      handleRestoreDraft,
      conversationIdRef,
      chatScrollRef,
      scrollAnchorRef,
      scrollIntentRef,
      attachedSourceIds,
      setAttachedSourceIds,
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
      handleRestoreDraft,
      attachedSourceIds,
    ],
  )
}

export type UseAgentChatResult = ReturnType<typeof useAgentChat>
