"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutationState, useQueryClient } from "@tanstack/react-query"
import { Info, HelpCircle, MessageSquare, FolderOpen, ArrowLeft, ChevronDown, Plug } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { apiFetch, ApiError } from "@/lib/api/client"
import { getAgent } from "@/lib/config/agents"
import {
  getMessages,
  useSendMessage,
  AgentNotAvailableError,
} from "@/lib/api/assistants"
import { useBrandKit } from "@/lib/api/brain"
import { useGoogleConnected } from "@/lib/api/auth-accounts"

import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { MediaViewerProvider } from "@/components/chat/MediaViewer"
import { PlusMenu } from "@/components/chat/PlusMenu"
import { HelpSheet } from "@/components/chat/HelpSheet"
import { OnboardMeModal } from "@/components/assistants/OnboardMeModal"
import { RunActionDialog } from "@/components/chat/RunActionDialog"
import type { ActionResultContext } from "@/components/chat/ActionDialog"
import { LexDocumentsTab } from "@/components/agents/lex/documents-tab"
import { SageSavedKeywordsTab } from "@/components/agents/sage/saved-keywords-tab"
import { RexDataTab, REX_DATASETS_KEY } from "@/components/agents/rex/data-tab"

import { MagicNumbers } from "@/components/agents/rex/magic-numbers"
import { MayaPublishedPostsTab } from "@/components/agents/maya/published-posts-tab"
import { MayaCreditsPill } from "@/components/agents/maya/credits-pill"
import { MayaTopUpButton } from "@/components/agents/maya/topup-dialog"
import type { LexSource, SageSavedKeyword } from "@/lib/types/agents"
import { qk } from "@/lib/query-keys"

import AgentInfoPanel from "@/components/assistants/AgentInfoPanel"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { getUpgradeRequiredReason } from "@/components/billing/upgrade-errors"
import { FeatureLockBanner } from "@/components/ui/feature-lock-banner"
import { GOOGLE_FEATURES_LOCKED } from "@/lib/config/features"
import { FONT } from "@/lib/fonts"
import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/ui/sticker"
// Agent photos are served from /agents/{id}.jpeg (copied from landing/public)
const AGENT_PHOTOS: Record<string, string> = {
  maya: "/agents/maya.jpeg", rex: "/agents/rex.jpeg", sage: "/agents/sage.jpeg",
  scout: "/agents/scout.jpeg", lex: "/agents/lex.jpeg", vega: "/agents/vega.jpeg",
}

import type {
  Message,
  AgentConfig,
  AgentSlug,
} from "@/lib/types"
import type { AgentActionId, MayaDraftResult, MayaImageRegenResult, MayaVariantResult, MayaCampaignResult, MayaCarouselDraftResult, ImageResult, MayaContentRegenResult } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"

function ChatHeader({
  agent,
  onInfoClick,
  onHelpClick,
  onOnboardClick,
}: {
  agent: AgentConfig
  onInfoClick: () => void
  onHelpClick: () => void
  onOnboardClick: () => void
}) {
  const agentPhoto = AGENT_PHOTOS[agent.id]
  return (
    <div
      style={{
        background: "#FFF9ED",
        borderBottom: "1px solid #E5E5E5",
        borderLeft: `4px solid ${agent.color}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Mobile-only back button */}
      <Link
        href="/assistants"
        className="md:hidden flex items-center justify-center shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.06)",
          color: "#555",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Back to assistants"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
      </Link>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onInfoClick}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1.5px solid rgba(0,0,0,0.1)",
          background: agent.color,
          flexShrink: 0,
          cursor: "pointer",
          padding: 0,
        }}
        aria-label="Agent info"
      >
        {agentPhoto ? (
          <img src={agentPhoto} alt={agent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              fontFamily: FONT.head,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {agent.initials}
          </div>
        )}
      </button>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onInfoClick}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        aria-label="Agent info"
      >
        <div style={{ fontFamily: FONT.head, fontSize: 15, color: "#111", letterSpacing: -0.2 }}>
          {agent.name}
        </div>
        <div style={{ fontSize: 12, color: "#888", display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1DBC87", display: "inline-block" }} />
          online
        </div>
      </button>
      <button
        suppressHydrationWarning
        type="button"
        data-tour="onboard-me-button"
        onClick={onOnboardClick}
        aria-label={`Onboard ${agent.name}`}
        title="Onboard me — connect my tools"
        style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: "#888", borderRadius: "50%" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
      >
        <Plug className="size-4" />
      </button>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onHelpClick}
        aria-label="Help"
        style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: "#888", borderRadius: "50%" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
      >
        <HelpCircle className="size-4" />
      </button>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onInfoClick}
        aria-label="Agent info"
        style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: "#888", borderRadius: "50%" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
      >
        <Info className="size-4" />
      </button>
    </div>
  )
}

function EmptyState({
  agent,
  onPrompt,
}: {
  agent: AgentConfig
  onPrompt: (prompt: string) => void
}) {
  const agentPhoto2 = AGENT_PHOTOS[agent.id]
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#EFE7D6",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <Sticker rotate={-6} style={{ background: agent.color as string }}>
            {agent.tag}
          </Sticker>
        </div>
        <div
          style={{
            width: 140,
            height: 140,
            margin: "0 auto",
            borderRadius: 20,
            overflow: "hidden",
            border: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            background: agent.color,
            transform: "rotate(-2deg)",
          }}
        >
          {agentPhoto2 ? (
            <img src={agentPhoto2} alt={agent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                fontFamily: FONT.display,
                fontSize: 56,
                color: "#111",
              }}
            >
              {agent.initials}
            </div>
          )}
        </div>

        <h2
          style={{
            fontFamily: FONT.display,
            fontSize: 56,
            lineHeight: 1,
            color: "#111",
            margin: "28px 0 4px",
            letterSpacing: -1,
          }}
        >
          say hi to {agent.name.toLowerCase()}
        </h2>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 15,
            lineHeight: 1.5,
            color: "#333",
            margin: "0 auto 8px",
            maxWidth: 440,
          }}
        >
          {agent.description}
        </p>
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
            margin: "0 0 20px",
          }}
        >
          {"// try one of these"}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {agent.quickPrompts.map((prompt) => (
            <button
              suppressHydrationWarning
              key={prompt}
              onClick={() => onPrompt(prompt)}
              style={{
                fontFamily: FONT.body,
                fontSize: 13,
                padding: "10px 14px",
                background: "#FFF9ED",
                border: "1.5px solid #D4C9B0",
                borderRadius: 999,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                cursor: "pointer",
                color: "#111",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EFE7D6"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFF9ED"
                e.currentTarget.style.transform = "translate(0,0)"
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function genConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AssistantChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const agent = getAgent(id)

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const WINDOW = 20
  const [msgWindow, setMsgWindow] = useState<Message[]>([])
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [isLoadingPrev, setIsLoadingPrev] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [fetchError, setFetchError] = useState<ApiError | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const chatCacheKey = (orgId: string, agentId: string) => `vq.chat.${orgId}.${agentId}`

  useEffect(() => {
    if (!id || !organizationId) return
    setFetchError(null)

    // Paint instantly from localStorage cache (stale-while-revalidate)
    try {
      const raw = localStorage.getItem(chatCacheKey(organizationId, id))
      if (raw) {
        const cached: Message[] = JSON.parse(raw)
        scrollIntentRef.current = "instant"
        setMsgWindow(cached)
        setHasPreviousPage(cached.length === WINDOW)
        setInitialLoaded(true)
      } else {
        setInitialLoaded(false)
        setMsgWindow([])
      }
    } catch {
      setInitialLoaded(false)
      setMsgWindow([])
    }

    // Refresh from server in background
    getMessages(id, organizationId)
      .then((msgs) => {
        scrollIntentRef.current = "instant"
        setMsgWindow(msgs)
        setHasPreviousPage(msgs.length === WINDOW)
        setInitialLoaded(true)
        try {
          localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
        } catch {}
      })
      .catch((err) => {
        if (err instanceof ApiError) setFetchError(err)
        setInitialLoaded(true)
      })
  }, [id, organizationId])

  // Persist window to localStorage after every settled update
  useEffect(() => {
    if (!initialLoaded || !id || !organizationId || msgWindow.length === 0) return
    try {
      localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgWindow))
    } catch {}
  }, [msgWindow, initialLoaded, id, organizationId])

  const loadPreviousPage = useCallback(async () => {
    if (!hasPreviousPage || isLoadingPrev) return
    setIsLoadingPrev(true)
    try {
      const oldest = msgWindow[0]?.createdAt
      const older = await getMessages(id, organizationId, oldest)
      // Capture scrollHeight before the state update so useLayoutEffect can restore position
      scrollAnchorRef.current = chatScrollRef.current?.scrollHeight ?? 0
      setMsgWindow((prev) => [...older, ...prev])
      setHasPreviousPage(older.length === WINDOW)
    } finally {
      setIsLoadingPrev(false)
    }
  }, [hasPreviousPage, isLoadingPrev, msgWindow, id, organizationId])
  const { data: brandKit = null } = useBrandKit(organizationId)
  const { data: googleLinked } = useGoogleConnected(agent?.id === "vega")
  const { data: rexDatasetCount = 0 } = useQuery({
    queryKey: REX_DATASETS_KEY(organizationId),
    queryFn: () => apiFetch<{ id: string }[]>("/agents/rex/datasets"),
    select: (d) => d.length,
    enabled: id === "rex" && !!organizationId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const [content, setContent] = useState("")
  const [sendError, setSendError] = useState<ApiError | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)
  const [activePrefill, setActivePrefill] = useState<Record<string, unknown> | undefined>(undefined)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [lexTab, setLexTab] = useState<"chat" | "documents">("chat")
  const [sageTab, setSageTab] = useState<"chat" | "favourites">("chat")
  const [rexTab, setRexTab] = useState<"chat" | "data">("chat")
  const [mayaTab, setMayaTab] = useState<"chat" | "published">("chat")

  const conversationIdRef = useRef<string>(genConversationId())
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const scrollAnchorRef = useRef<number | null>(null)
  const scrollIntentRef = useRef<"instant" | "smooth" | null>("instant")
  const thisMutationRef = useRef(false)
  const prevMutationStatusRef = useRef<string | undefined>(undefined)
  const didCatchUpRef = useRef(false) // Guards the "already-complete-on-mount" fetch
  const isAtBottomRef = useRef(isAtBottom) // Latest scroll position for action callbacks
  isAtBottomRef.current = isAtBottom

  const sendMutation = useSendMessage(id, organizationId, conversationIdRef.current, {
    onOptimistic: (optimistic) => {
      thisMutationRef.current = true
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, optimistic].slice(-WINDOW))
      setHasPreviousPage(true)
    },
    onSuccess: (serverMsg) => {
      scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => {
        const withoutOptimistic = prev.slice(0, -1)
        const updated = [...withoutOptimistic, serverMsg]

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
    onError: () => {
      setMsgWindow((prev) => prev.slice(0, -1))
    },
  })

  // useMutationState survives navigation (lives on QueryClient, not the component).
  // This keeps the typing indicator visible when you switch agents and come back.
  const pendingCount = useMutationState({
    filters: { mutationKey: ["sendMessage", id, organizationId], status: "pending" },
  }).length
  const mutationStatuses = useMutationState({
    filters: { mutationKey: ["sendMessage", id, organizationId] },
    select: (m) => m.state.status,
  })
  const latestMutationStatus = mutationStatuses[mutationStatuses.length - 1]
  // Ref to read latest mutation status from event listeners without stale closures
  const latestMutationStatusRef = useRef(latestMutationStatus)
  latestMutationStatusRef.current = latestMutationStatus // Keep updated on every render
  const isLoading = pendingCount > 0 || sendMutation.isPending
  const isBusy = isLoading || actionSubmitting
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
    getMessages(id, organizationId).then((msgs) => {
      scrollIntentRef.current = "smooth"
      setMsgWindow(msgs)
      setHasPreviousPage(msgs.length === WINDOW)
      try {
        localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
      } catch {}
    })
  }, [latestMutationStatus, id, organizationId])

  // Refetch when user returns to this tab — covers the "agent finished while on
  // another tab" case. React Query has refetchOnWindowFocus disabled globally,
  // so this targeted listener handles only the chat message list.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return
      const status = latestMutationStatusRef.current
      if (status !== "pending" && status !== "success") return
      getMessages(id, organizationId).then((msgs) => {
        setMsgWindow(msgs)
        setHasPreviousPage(msgs.length === WINDOW)
        try {
          localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
        } catch {}
      })
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [id, organizationId]) // Only re-register when agent changes, not on every status change

  // If a mutation for this agent completed before this component mounted, the
  // orphaned detection can't catch it (no pending→success transition seen).
  // After initialLoaded settles, do one additional fetch as belt-and-suspenders.
  useEffect(() => {
    if (!initialLoaded || didCatchUpRef.current) return
    if (latestMutationStatus !== "success" || mutationStatuses.length === 0) return
    didCatchUpRef.current = true
    getMessages(id, organizationId).then((msgs) => {
      setMsgWindow(msgs)
      setHasPreviousPage(msgs.length === WINDOW)
      try {
        localStorage.setItem(chatCacheKey(organizationId, id), JSON.stringify(msgs))
      } catch {}
    })
  }, [initialLoaded, latestMutationStatus, mutationStatuses.length, id, organizationId])

  useEffect(() => {
    if (!agent) router.push("/assistants")
  }, [agent, router])

  useLayoutEffect(() => {
    const el = chatScrollRef.current
    if (!el) return

    // Priority 1: restore position after prepending older messages
    if (scrollAnchorRef.current !== null) {
      el.scrollTop = el.scrollHeight - scrollAnchorRef.current
      scrollAnchorRef.current = null
      return
    }

    // Priority 2: scroll to bottom with the requested intent
    const intent = scrollIntentRef.current
    if (intent) {
      scrollIntentRef.current = null
      if (intent === "smooth") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
      } else {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [msgWindow, isBusy])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 1000 || isLoading) return

    setContent("")
    try {
      await sendMutation.mutateAsync(trimmed)
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setSendError(err)
      } else if (err instanceof AgentNotAvailableError) {
        toast.error(
          `${agent?.name ?? "This agent"} isn't connected yet — backend route is being set up. Try again soon.`
        )
      } else {
        toast.error("Failed to send message. Please try again.")
      }
    }
  }, [content, isLoading, sendMutation, agent])

  // Writes an optimistic user message as soon as the dialog starts submitting,
  // so the chat doesn't look empty while the API call is in flight.
  // Skipped for maya:regenerate-image since that action mutates an existing
  // message in-place rather than starting a new thread.
  const handleActionStart = useCallback(
    (ctx: { actionId: AgentActionId; input: unknown }) => {
      if (ctx.actionId === "maya:regenerate-image") return
      if (ctx.actionId === "maya:regenerate-content") return

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
    [id, organizationId],
  )

  const handleActionComplete = useCallback(
    (ctx: ActionResultContext<unknown, unknown>) => {
      const meta = findAction(ctx.actionId)
      const now = new Date().toISOString()

      // ── maya:regenerate-image ─────────────────────────────────────────────
      // Patches the source message in-place so the image swaps where it lives.
      // Matches by image_url across all card types. Falls back to appending a
      // new card only if no source message is found (e.g. triggered from menu).
      if (ctx.actionId === "maya:regenerate-image") {
        const regenResult = ctx.result as MayaImageRegenResult
        const inputImageUrl = (ctx.input as { image_url?: string }).image_url

        setMsgWindow((prev) => {
          const msgs = [...prev]
          let patched = false

          for (let i = msgs.length - 1; i >= 0; i--) {
            const ci = msgs[i].customInput
            if (!ci?.actionId || !ci.result) continue

            if (ci.actionId === "maya:draft-content") {
              const r = ci.result as MayaDraftResult
              if (!r?.draft) continue
              if (!inputImageUrl || r.image?.image_url === inputImageUrl) {
                msgs[i] = { ...msgs[i], customInput: { ...ci, result: { ...r, _previousImage: r.image ?? null, image: regenResult.image } } }
                patched = true; break
              }
            }
            if (ci.actionId === "maya:campaign") {
              const r = ci.result as MayaCampaignResult
              const idx = (r?.photos ?? []).findIndex((p) => p?.image?.image_url === inputImageUrl)
              if (idx >= 0) {
                const newPhotos = [...r.photos]
                newPhotos[idx] = { ...newPhotos[idx], image: regenResult.image }
                msgs[i] = { ...msgs[i], customInput: { ...ci, result: { ...r, photos: newPhotos } } }
                patched = true; break
              }
            }
            if (ci.actionId === "maya:draft-carousel") {
              const r = ci.result as MayaCarouselDraftResult
              const idx = (r?.slides ?? []).findIndex((s) => s?.image?.image_url === inputImageUrl)
              if (idx >= 0) {
                const newSlides = [...r.slides]
                newSlides[idx] = { ...newSlides[idx], image: regenResult.image }
                msgs[i] = { ...msgs[i], customInput: { ...ci, result: { ...r, slides: newSlides } } }
                patched = true; break
              }
            }
            if (ci.actionId === "maya:regenerate-image") {
              const r = ci.result as MayaImageRegenResult
              if (r?.image?.image_url === inputImageUrl) {
                msgs[i] = { ...msgs[i], customInput: { ...ci, result: regenResult } }
                patched = true; break
              }
            }
            if (ci.actionId === "maya:generate-variants") {
              const r = ci.result as MayaVariantResult
              const idx = (r?.variants ?? []).findIndex((v) => v?.image?.image_url === inputImageUrl)
              if (idx >= 0) {
                const newVariants = [...r.variants]
                newVariants[idx] = { ...newVariants[idx], image: regenResult.image }
                msgs[i] = { ...msgs[i], customInput: { ...ci, result: { ...r, variants: newVariants } } }
                patched = true; break
              }
            }
          }

          if (!patched) {
            if (isAtBottomRef.current) scrollIntentRef.current = "smooth"
            const userMsg: Message = { role: "user", content: meta?.label ?? "Regenerate image", imageUrl: null, createdAt: now }
            const assistantMsg: Message = { role: "assistant", content: "Image regenerated.", imageUrl: null, createdAt: now, customInput: { actionId: ctx.actionId, input: ctx.input, result: regenResult } }
            return [...msgs, userMsg, assistantMsg].slice(-WINDOW)
          }
          return msgs
        })
        toast.success("Image regenerated.")
        return
      }

      // ── maya:regenerate-content ───────────────────────────────────────────
      // Patches the most-recent DraftCard's caption/hashtags/cta in-place so
      // the rewrite appears where the post already lives, not as a new card.
      // Falls back to appending a ContentRegenCard only if no source is found.
      if (ctx.actionId === "maya:regenerate-content") {
        const regenResult = ctx.result as MayaContentRegenResult

        setMsgWindow((prev) => {
          const msgs = [...prev]
          let patched = false

          for (let i = msgs.length - 1; i >= 0; i--) {
            const ci = msgs[i].customInput
            if (!ci?.actionId || !ci.result) continue

            if (ci.actionId === "maya:draft-content") {
              const r = ci.result as MayaDraftResult
              if (!r?.draft) continue
              msgs[i] = {
                ...msgs[i],
                customInput: {
                  ...ci,
                  result: {
                    ...r,
                    draft: {
                      ...r.draft,
                      body: regenResult.caption,
                      hashtags: regenResult.hashtags,
                      cta: regenResult.cta,
                    },
                  },
                },
              }
              patched = true
              break
            }
          }

          if (!patched) {
            if (isAtBottomRef.current) scrollIntentRef.current = "smooth"
            const assistantMsg: Message = {
              role: "assistant",
              content: meta ? `${meta.label} — done.` : "Action complete.",
              imageUrl: null,
              createdAt: now,
              customInput: { actionId: ctx.actionId, input: ctx.input, result: regenResult },
            }
            return [...msgs, assistantMsg].slice(-WINDOW)
          }
          return msgs
        })

        toast.success(meta ? `${meta.label} complete.` : "Caption updated.")
        return
      }

      // ── maya:generate-variants ────────────────────────────────────────────
      // Enriches the result with the original image from the last draft.
      // The userMsg was already written by handleActionStart, so only the
      // assistant result card is appended here.
      if (ctx.actionId === "maya:generate-variants") {
        const serverResult = ctx.result as MayaVariantResult
        let originalImage: ImageResult | null = null
        for (let i = msgWindow.length - 1; i >= 0; i--) {
          if (msgWindow[i].customInput?.actionId === "maya:draft-content") {
            originalImage = (msgWindow[i].customInput!.result as MayaDraftResult)?.image ?? null
            break
          }
        }
        const enrichedResult: MayaVariantResult = { ...serverResult, _originalImage: originalImage }
        const assistantMsg: Message = {
          role: "assistant",
          content: meta ? `${meta.label} — done.` : "Action complete.",
          imageUrl: null,
          createdAt: now,
          customInput: { actionId: ctx.actionId, input: ctx.input, result: enrichedResult },
        }
        if (isAtBottomRef.current) scrollIntentRef.current = "smooth"
        setMsgWindow((prev) => [...prev, assistantMsg].slice(-WINDOW))
        toast.success(meta ? `${meta.label} complete.` : "Action complete.")
        return
      }

      // ── all other actions ─────────────────────────────────────────────────
      // The userMsg was already written by handleActionStart; only append the
      // assistant result card here.
      const assistantMsg: Message = {
        role: "assistant",
        content: meta ? `${meta.label} — done.` : "Action complete.",
        imageUrl: null,
        createdAt: now,
        customInput: {
          actionId: ctx.actionId,
          input: ctx.input,
          result: ctx.result,
        },
      }
      if (isAtBottomRef.current) scrollIntentRef.current = "smooth"
      setMsgWindow((prev) => [...prev, assistantMsg].slice(-WINDOW))
      toast.success(meta ? `${meta.label} complete.` : "Action complete.")
    },
    [id, organizationId, msgWindow],
  )

  const handleRevertImage = useCallback(
    (msgId: string) => {
      setMsgWindow((prev) => {
        const idx = prev.findIndex((m) => m.id === msgId)
        if (idx < 0) return prev
        const msgs = [...prev]
        const m = msgs[idx]
        const r = m.customInput?.result as MayaDraftResult | undefined
        if (!r?._previousImage) return prev
        msgs[idx] = {
          ...m,
          customInput: {
            ...m.customInput!,
            result: { ...r, image: r._previousImage, _previousImage: null },
          },
        }
        return msgs
      })
    },
    [],
  )

  const openAction = useCallback((actionId: AgentActionId, prefill?: Record<string, unknown>) => {
    setActivePrefill(prefill)
    setActiveActionId(actionId)
  }, [])

  // Cross-agent handoff: navigate to the target agent's page with the action pre-loaded.
  // Same-agent follow-ups open the dialog inline as before.
  const handleFollowUp = useCallback(
    (actionId: AgentActionId, prefill?: Record<string, unknown>) => {
      const targetAgent = actionId.split(":")[0]
      if (targetAgent === id) {
        openAction(actionId, prefill)
      } else {
        const qs = new URLSearchParams({ action: actionId })
        if (prefill) qs.set("prefill", JSON.stringify(prefill))
        router.push(`/assistants/${targetAgent}?${qs.toString()}`)
      }
    },
    [id, openAction, router],
  )

  // On mount: if URL contains ?action=..., open that action dialog then clean the URL.
  useEffect(() => {
    const action = searchParams.get("action") as AgentActionId | null
    if (!action) return
    const prefillStr = searchParams.get("prefill")
    const prefill = prefillStr ? (JSON.parse(prefillStr) as Record<string, unknown>) : undefined
    openAction(action, prefill)
    router.replace(`/assistants/${id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  // Return redirect from a Maya credit top-up checkout (billing.topup.ts's
  // return_url/cancel_url both point back here). Mirrors the status=success/
  // cancelled handling on settings/billing/page.tsx.
  useEffect(() => {
    const topup = searchParams.get("topup")
    if (!topup) return
    if (topup === "success") {
      toast.success("Credits added", { description: "Check your balance above." })
      if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
    } else if (topup === "cancelled") {
      toast.info("Top-up cancelled", { description: "No charge was made." })
    }
    router.replace(`/assistants/${id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  const discoverCompetitorsPrefill = useMemo(() =>
    brandKit
      ? { description: brandKit.companyDescription || "", industry: brandKit.industry || "", location: brandKit.location || "" }
      : undefined,
    [brandKit]
  )

  const handlePlusPick = (actionId: AgentActionId) => {
    setPlusOpen(false)
    if (actionId === "scout:discover-competitors") {
      openAction(actionId, discoverCompetitorsPrefill)
    } else {
      openAction(actionId)
    }
  }

  const openAnalyzeForSource = useCallback((source: LexSource) => {
    setLexTab("chat")
    openAction("lex:analyze-contract", { source_id: source.sourceId })
  }, [openAction])

  const openQueryForSource = useCallback((source: LexSource) => {
    setLexTab("chat")
    openAction("lex:query-document", { sourceId: source.sourceId })
  }, [openAction])

  const openUploadAction = useCallback(() => {
    setLexTab("chat")
    openAction("lex:upload-source")
  }, [openAction])

  const openCampaignAction = useCallback(() => {
    openAction("maya:campaign")
  }, [openAction])

  const agentColor = useMemo(() => agent?.color ?? "var(--vq-yellow)", [agent])
  const agentPhotoUrl = AGENT_PHOTOS[agent?.id ?? ""] ?? undefined

  // Merge each maya:regenerate-image message into its source card so that on
  // refresh the image swap is preserved instead of rendering a separate card.
  // NOTE: must stay above all early returns to satisfy the Rules of Hooks.
  const displayMessages = useMemo(() => {
    const merged = [...msgWindow]
    const toRemove = new Set<number>()

    for (let i = 0; i < merged.length; i++) {
      const ci = merged[i].customInput
      if (ci?.actionId !== "maya:regenerate-image") continue
      const regenResult = ci.result as MayaImageRegenResult | undefined
      if (!regenResult?.image) continue
      const inputImageUrl = (ci.input as { image_url?: string } | undefined)?.image_url

      let patched = false
      for (let j = i - 1; j >= 0; j--) {
        const src = merged[j].customInput
        if (!src?.actionId || !src.result) continue

        if (src.actionId === "maya:draft-content") {
          const r = src.result as MayaDraftResult
          if (!inputImageUrl || r.image?.image_url === inputImageUrl) {
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, image: regenResult.image } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:draft-carousel") {
          const r = src.result as MayaCarouselDraftResult
          const idx = (r?.slides ?? []).findIndex((s) => s?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newSlides = [...r.slides]
            newSlides[idx] = { ...newSlides[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, slides: newSlides } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:campaign") {
          const r = src.result as MayaCampaignResult
          const idx = (r?.photos ?? []).findIndex((p) => p?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newPhotos = [...r.photos]
            newPhotos[idx] = { ...newPhotos[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, photos: newPhotos } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:generate-variants") {
          const r = src.result as MayaVariantResult
          const idx = (r?.variants ?? []).findIndex((v) => v?.image?.image_url === inputImageUrl)
          if (idx >= 0) {
            const newVariants = [...r.variants]
            newVariants[idx] = { ...newVariants[idx], image: regenResult.image }
            merged[j] = { ...merged[j], customInput: { ...src, result: { ...r, variants: newVariants } } }
            patched = true; break
          }
        }
        if (src.actionId === "maya:regenerate-image") {
          const r = src.result as MayaImageRegenResult
          if (r?.image?.image_url === inputImageUrl) {
            merged[j] = { ...merged[j], customInput: { ...src, result: regenResult } }
            patched = true; break
          }
        }
      }

      if (patched) {
        // Also remove the preceding user message that triggered the regen
        if (i > 0 && merged[i - 1].role === "user") toRemove.add(i - 1)
        toRemove.add(i)
      }
    }

    // Merge maya:regenerate-content messages (from regular chat) into the most
    // recent DraftCard's caption/hashtags/cta, then hide the regen message.
    for (let i = 0; i < merged.length; i++) {
      if (toRemove.has(i)) continue
      const ci = merged[i].customInput
      if (ci?.actionId !== "maya:regenerate-content") continue
      const regenResult = ci.result as MayaContentRegenResult | undefined
      if (!regenResult?.caption) continue

      let patched = false
      for (let j = i - 1; j >= 0; j--) {
        if (toRemove.has(j)) continue
        const src = merged[j].customInput
        if (!src?.actionId || !src.result) continue

        if (src.actionId === "maya:draft-content") {
          const r = src.result as MayaDraftResult
          if (!r?.draft) continue
          merged[j] = {
            ...merged[j],
            customInput: {
              ...src,
              result: { ...r, draft: { ...r.draft, body: regenResult.caption, hashtags: regenResult.hashtags, cta: regenResult.cta } },
            },
          }
          patched = true
          break
        }
      }

      if (patched) {
        if (i > 0 && merged[i - 1].role === "user") toRemove.add(i - 1)
        toRemove.add(i)
      }
    }

    return merged.filter((_, i) => !toRemove.has(i))
  }, [msgWindow])

  if (!agent) return null

  // Surface entitlement gate: messages fetch returned 402, or a send attempt hit 402.
  // Normalized through getUpgradeRequiredReason (same as briefing/InboxView/CalendarView)
  // so this shows the specific trial/expired/not-purchased copy instead of the
  // generic fallback — the raw error code doesn't match UpgradeRequiredCard's copy map.
  const upgradeError =
    (fetchError?.status === 402 ? fetchError : null) ?? sendError
  const upgradeReason = getUpgradeRequiredReason(upgradeError)
  if (upgradeReason) {
    return <UpgradeRequiredCard reason={upgradeReason} />
  }

  const isLex = agent.id === "lex"
  const isSage = agent.id === "sage"
  const isRex = agent.id === "rex"
  const isMaya = agent.id === "maya"
  const isVega = agent.id === "vega"
  const hasMessages = msgWindow.length > 0
  const agentSlug = agent.id as AgentSlug

  return (
    <MediaViewerProvider>
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ChatHeader
        agent={agent}
        onInfoClick={() => setInfoOpen(true)}
        onHelpClick={() => setHelpOpen(true)}
        onOnboardClick={() => setOnboardOpen(true)}
      />

      {isLex && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid #E5E5E5",
            background: "#FFF9ED",
          }}
        >
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setLexTab("chat")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              lexTab === "chat" ? "bg-[#111] text-white" : "bg-[#F0F0F0] text-[#555]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setLexTab("documents")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              lexTab === "documents"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Documents
          </button>
        </div>
      )}


      {isSage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid #E5E5E5",
            background: "#FFF9ED",
          }}
        >
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setSageTab("chat")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              sageTab === "chat" ? "bg-[#111] text-white" : "bg-[#F0F0F0] text-[#555]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setSageTab("favourites")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              sageTab === "favourites"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Favourites
          </button>
        </div>
      )}

      {isRex && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderBottom: "2px solid #111",
              background: "#FFF9ED",
            }}
          >
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setRexTab("chat")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                rexTab === "chat" ? "bg-[#111] text-white" : "bg-[#F0F0F0] text-[#555]"
              }`}
            >
              <MessageSquare className="size-3" /> Chat
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setRexTab("data")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                rexTab === "data" ? "bg-[#111] text-white" : "bg-[#F0F0F0] text-[#555]"
              }`}
            >
              <FolderOpen className="size-3" /> Data
              {rexDatasetCount > 0 && (
                <span
                  className="ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] leading-none"
                  style={{
                    background: rexTab === "data" ? "#EFE7D6" : agent.color as string,
                    color: "#111",
                  }}
                >
                  {rexDatasetCount}
                </span>
              )}
            </button>
          </div>
          <MagicNumbers organizationId={organizationId} />
        </>
      )}

      {isMaya && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid #E5E5E5",
            background: "#FFF9ED",
          }}
        >
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMayaTab("chat")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mayaTab === "chat" ? "bg-[#111] text-white" : "bg-[#F0F0F0] text-[#555]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMayaTab("published")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mayaTab === "published"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Published Posts
          </button>
          <div className="flex items-center gap-1.5" style={{ marginLeft: "auto" }}>
            <MayaCreditsPill organizationId={organizationId} />
            <MayaTopUpButton organizationId={organizationId} />
          </div>
        </div>
      )}

      {isMaya && mayaTab === "published" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MayaPublishedPostsTab />
        </div>
      ) : isLex && lexTab === "documents" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <LexDocumentsTab
            onUpload={openUploadAction}
            onAnalyze={openAnalyzeForSource}
            onQuery={openQueryForSource}
          />
        </div>
      ) : isSage && sageTab === "favourites" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SageSavedKeywordsTab
            onGenerateBlog={(kw: SageSavedKeyword) => {
              setSageTab("chat")
              openAction("sage:generate-blog", { target_keyword: kw.keyword })
            }}
          />
        </div>
      ) : isRex && rexTab === "data" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <RexDataTab
            organizationId={organizationId}
            onOpenAction={(actionId, prefill) => {
              setRexTab("chat")
              openAction(actionId as AgentActionId, prefill)
            }}
            onSwitchToChat={() => setRexTab("chat")}
          />
        </div>
      ) : isVega && GOOGLE_FEATURES_LOCKED ? (
        <FeatureLockBanner
          title="vega"
          description="Vega manages your inbox, schedules meetings, and delivers executive briefings — powered by Gmail and Google Calendar. She'll be ready very soon."
        />
      ) : historyLoaded && !hasMessages && !isBusy ? (
        <EmptyState agent={agent} onPrompt={(p) => setContent(p)} />
      ) : (
        <div className="relative flex-1 min-h-0">
          <div
            ref={chatScrollRef}
            className="h-full overflow-y-auto"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              padding: "16px 20px",
              background: "#EFE7D6",
            }}
            onScroll={(e) => {
              const el = e.currentTarget
              setIsAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 50)
              if (el.scrollTop < 80 && hasPreviousPage && !isLoadingPrev) {
                void loadPreviousPage()
              }
            }}
          >
            {hasPreviousPage && (
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
                <button
                  onClick={() => void loadPreviousPage()}
                  disabled={isLoadingPrev}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#888",
                    background: "rgba(239,231,214,0.85)",
                    border: "1px solid #E0E0E0",
                    borderRadius: 999,
                    padding: "5px 14px",
                    cursor: isLoadingPrev ? "default" : "pointer",
                    opacity: isLoadingPrev ? 0.6 : 1,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  {isLoadingPrev ? "loading…" : "↑ load older messages"}
                </button>
              </div>
            )}
            {displayMessages.map((msg, i) => (
              <ChatMessage
                key={msg.id ?? `msg-${i}`}
                message={msg}
                agentName={agent.name}
                agentInitials={agent.initials}
                agentColor={agentColor}
                agentPhoto={agentPhotoUrl}
                isLex={isLex}
                showAvatar={msg.role !== "assistant" || i === 0 || displayMessages[i - 1]?.role !== "assistant"}
                marginTop={i === 0 ? 0 : displayMessages[i - 1]?.role === msg.role ? 4 : 12}
                onFollowUpAction={handleFollowUp}
                onRevertImage={msg.id ? () => handleRevertImage(msg.id!) : undefined}
              />
            ))}
            {isBusy && (
              <TypingIndicator
                agentInitials={agent.initials}
                agentColor={agentColor}
                agentPhoto={agentPhotoUrl}
              />
            )}
          </div>
          {/* Scroll to latest button */}
          <button
            type="button"
            onClick={() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" })}
            aria-label="Scroll to latest"
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#111",
              color: "#fff",
              border: "none",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
              transition: "opacity 200ms, transform 200ms",
              opacity: isAtBottom ? 0 : 1,
              transform: isAtBottom ? "translateY(8px)" : "translateY(0)",
              pointerEvents: isAtBottom ? "none" : "auto",
              zIndex: 10,
            }}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      )}

      <div style={{ flexShrink: 0 }}>
        {isVega && googleLinked === false && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "#FFFBEB",
              borderTop: "1px solid #E5E5E5",
              padding: "10px 20px",
            }}
          >
            <p
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 1,
                color: "#333",
                margin: 0,
              }}
            >
              {"// connect google calendar to let vega schedule on your behalf"}
            </p>
            <Button
              variant="brand-dark"
              size="brand-sm"
              onClick={() => {
                authClient.signIn.social({
                  provider: "google",
                  callbackURL: `${window.location.origin}/assistants/vega`,
                })
              }}
            >
              Connect Google
            </Button>
          </div>
        )}

        {!(isLex && lexTab === "documents") &&
          !(isSage && sageTab === "favourites") &&
          !(isRex && rexTab === "data") &&
          !(isMaya && mayaTab === "published") && (
          <ChatInput
            value={content}
            onChange={setContent}
            onSend={handleSend}
            onPlusClick={() => setPlusOpen(true)}
            onAttachClick={isLex ? openUploadAction : undefined}
            placeholder={isVega && GOOGLE_FEATURES_LOCKED ? "Vega is coming soon…" : `Message ${agent.name.toLowerCase()}…`}
            disabled={isLoading || (isVega && GOOGLE_FEATURES_LOCKED)}
          />
        )}
      </div>

      <AgentInfoPanel
        agent={agent}
        kit={brandKit}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        organizationId={organizationId}
      />

      <PlusMenu
        open={plusOpen}
        onOpenChange={setPlusOpen}
        agentSlug={agentSlug}
        agentName={agent.name}
        onPick={(a) => handlePlusPick(a.id)}
      />
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} agent={agent} />
      <OnboardMeModal
        agentSlug={agentSlug}
        agentName={agent.name}
        open={onboardOpen}
        onOpenChange={setOnboardOpen}
      />
      <RunActionDialog
        open={!!activeActionId}
        onOpenChange={(v) => {
          if (!v) {
            setActiveActionId(null)
            setActivePrefill(undefined)
          }
        }}
        actionId={activeActionId}
        organizationId={organizationId}
        conversationId={conversationIdRef.current}
        prefill={activePrefill}
        onStart={handleActionStart}
        onComplete={handleActionComplete}
        onSubmittingChange={setActionSubmitting}
      />
    </div>
    </MediaViewerProvider>
  )
}