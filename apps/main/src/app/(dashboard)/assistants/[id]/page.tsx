"use client"

import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, HelpCircle, MessageSquare, FolderOpen, ArrowLeft, ChevronDown, Plug, CalendarDays, Pin, X } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { apiFetch } from "@/lib/api/client"
import { getAgent } from "@/lib/config/agents"
import { useBrandKit } from "@/lib/api/brain"
import { useLexSources } from "@/lib/api/lex"
import { usePinnedMessages, useTogglePinMessage } from "@/lib/api/messages"
import { useAgentChat, WINDOW } from "@/lib/hooks/use-agent-chat"
import { useMcpConnections, useMcpToolPreference, useSetMcpToolPreference } from "@/lib/api/mcp"
import { getIntegrationsByAgent } from "@repo/integrations-catalog"

import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { MediaViewerProvider } from "@/components/chat/MediaViewer"
import type { ActionResultContext } from "@/components/chat/ActionDialog"

import type { ContentPlanItem } from "@/lib/api/assistants"
import { getBillingStatus } from "@/lib/api/billing"
import type { LexSource, SageSavedKeyword } from "@/lib/types/agents"
import { qk } from "@/lib/query-keys"

import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { getUpgradeRequiredReason } from "@/components/billing/upgrade-errors"
import { Sticker } from "@/components/ui/sticker"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { expandTemplate } from "@/lib/agents/maya/videoTemplates"

const AgentInfoPanel = dynamic(() => import("@/components/assistants/AgentInfoPanel"))
const HelpSheet = dynamic(() => import("@/components/chat/HelpSheet").then((module) => module.HelpSheet))
const LexDocumentsTab = dynamic(() => import("@/components/agents/lex/documents-tab").then((module) => module.LexDocumentsTab))
const MayaContentPlanTab = dynamic(() => import("@/components/agents/maya/content-plan-tab").then((module) => module.MayaContentPlanTab))
const MayaPublishedPostsTab = dynamic(() => import("@/components/agents/maya/published-posts-tab").then((module) => module.MayaPublishedPostsTab))
const OnboardMeModal = dynamic(() => import("@/components/assistants/OnboardMeModal").then((module) => module.OnboardMeModal))
const RunActionDialog = dynamic(() => import("@/components/chat/RunActionDialog").then((module) => module.RunActionDialog))
const SageSavedKeywordsTab = dynamic(() => import("@/components/agents/sage/saved-keywords-tab").then((module) => module.SageSavedKeywordsTab))
const ToolsMenu = dynamic(() => import("@/components/chat/ToolsMenu").then((module) => module.ToolsMenu))
const VideoTemplatePicker = dynamic(() => import("@/components/chat/VideoTemplatePicker").then((module) => module.VideoTemplatePicker))
const RexDataTab = dynamic(() => import("@/components/agents/rex/data-tab").then((module) => module.RexDataTab))
const MagicNumbers = dynamic(() => import("@/components/agents/rex/magic-numbers").then((module) => module.MagicNumbers))
const MayaCreditsPill = dynamic(() => import("@/components/agents/maya/credits-pill").then((module) => module.MayaCreditsPill))
const MayaTopUpButton = dynamic(() => import("@/components/agents/maya/topup-dialog").then((module) => module.MayaTopUpButton))

// Scout's native research tools call their own default data source (Serper)
// internally and can't reliably be prompted to prefer a connected MCP tool
// instead — see SUPERSEDABLE_BY_MCP in apps/ai/agents/base.py. This toggle
// lets the org explicitly override the source rather than leaving it to the
// LLM. Scout-only for now; a separate component so its hooks only run when
// actually mounted (i.e. only for the scout agent page).
function ScoutSearchSourceToggle() {
  const { data: connections } = useMcpConnections()
  const { data: preference } = useMcpToolPreference("scout")
  const setPreference = useSetMcpToolPreference("scout")

  const options = getIntegrationsByAgent("scout")
    .filter((e) => e.status === "composio")
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      connected: connections?.some((c) => c.slug === e.slug && c.status === "CONNECTED") ?? false,
    }))
    .filter((e) => e.connected)

  if (options.length === 0) return null

  const selectedSlug = options.some(
    (option) => option.slug === preference?.preferredIntegrationSlug,
  )
    ? preference!.preferredIntegrationSlug!
    : "__default"

  return (
    <Select
      value={selectedSlug}
      onValueChange={(value) =>
        setPreference.mutate(
          !value || value === "__default" ? null : String(value),
        )
      }
      disabled={setPreference.isPending}
    >
      <SelectTrigger
        aria-label="Scout research source"
        title="Which research source Scout should use"
        className="h-7 w-19 shrink-0 rounded-md border-black/15 bg-transparent px-2 text-[11px] text-muted-foreground sm:w-31 sm:text-xs"
      >
        <SelectValue>
          {(value) => {
            if (!value || value === "__default") return "Default"
            return options.find((option) => option.slug === value)?.name ?? String(value)
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-36 rounded-md">
        <SelectItem value="__default">Default search</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.slug} value={option.slug}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChatHeader({
  agent,
  onInfoClick,
  onHelpClick,
  onOnboardClick,
  onPinnedClick,
  pinnedCount,
}: {
  agent: AgentConfig
  onInfoClick: () => void
  onHelpClick: () => void
  onOnboardClick: () => void
  onPinnedClick: () => void
  pinnedCount: number
}) {
  const agentPhoto = AGENT_PHOTOS[agent.id]
  return (
    <div
      className="flex items-center gap-1 border-b border-(--vq-line-2) bg-card px-2 py-2.5 sm:gap-2.5 sm:px-4"
      style={{ borderLeft: `4px solid ${agent.color}` }}
    >
      {/* Mobile-only back button */}
      <Link
        href="/assistants"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-black/6 md:hidden"
        aria-label="Back to assistants"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onInfoClick}
        className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/10 p-0"
        style={{ background: agent.color }}
        aria-label="Agent info"
      >
        {agentPhoto ? (
          <Image src={agentPhoto} alt={agent.name} fill sizes="40px" className="object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center font-head text-sm text-white">
            {agent.initials}
          </div>
        )}
      </button>
      <button
        suppressHydrationWarning
        type="button"
        onClick={onInfoClick}
        className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
        aria-label="Agent info"
      >
        <div className="font-head text-[15px] tracking-tight text-foreground">
          {agent.name}
        </div>
        <div className="mt-px flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block size-1.75 rounded-full bg-chart-2" />
          online
        </div>
      </button>
      {agent.id === "scout" && <ScoutSearchSourceToggle />}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative rounded-full text-muted-foreground"
        onClick={onPinnedClick}
        aria-label="Pinned messages"
        title="Pinned messages"
      >
        <Pin className="size-4" />
        {pinnedCount > 0 && (
          <span className="absolute top-0.5 right-0.5 grid size-3.5 place-items-center rounded-full bg-primary font-mono text-[9px] text-primary-foreground">
            {pinnedCount > 9 ? "9+" : pinnedCount}
          </span>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-muted-foreground"
        data-tour="onboard-me-button"
        onClick={onOnboardClick}
        aria-label={`Onboard ${agent.name}`}
        title="Onboard me — connect my tools"
      >
        <Plug className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-muted-foreground"
        onClick={onHelpClick}
        aria-label="Help"
      >
        <HelpCircle className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hidden rounded-full text-muted-foreground sm:flex"
        onClick={onInfoClick}
        aria-label="Agent info"
      >
        <Info className="size-4" />
      </Button>
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
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
      <div className="relative w-full max-w-140 text-center">
        <div className="mb-3.5 flex justify-center">
          <Sticker rotate={-6} style={{ background: agent.color as string }}>
            {agent.tag}
          </Sticker>
        </div>
        <div
          className="relative mx-auto size-35 overflow-hidden rounded-2xl shadow-(--vq-shadow-lg)"
          style={{ background: agent.color }}
        >
          {agentPhoto2 ? (
            <Image src={agentPhoto2} alt={agent.name} fill sizes="140px" className="object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center font-display text-5xl text-foreground">
              {agent.initials}
            </div>
          )}
        </div>

        <h2 className="mx-0 mt-7 mb-1 font-display text-5xl leading-none tracking-tight text-foreground">
          say hi to {agent.name.toLowerCase()}
        </h2>
        <p className="mx-auto mb-2 max-w-110 font-body text-[15px] leading-relaxed text-foreground/80">
          {agent.description}
        </p>
        <p className="mb-5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {"// try one of these"}
        </p>

        <div className="flex flex-wrap justify-center gap-2.5">
          {agent.quickPrompts.map((prompt) => (
            <button
              suppressHydrationWarning
              key={prompt}
              onClick={() => onPrompt(prompt)}
              className="cursor-pointer rounded-full border border-(--vq-line-2) bg-card px-3.5 py-2.5 font-body text-[13px] text-foreground shadow-(--vq-shadow-sm) transition-colors hover:bg-background"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AssistantChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const agent = getAgent(id)

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const {
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
    isAnchored,
    highlightedMessageId,
    jumpToMessage,
    returnToLatest,
    clearHighlight,
  } = useAgentChat(id, organizationId, agent?.name)

  const { data: brandKit = null } = useBrandKit(organizationId)
  const { data: lexSources = [] } = useLexSources(id === "lex")
  const { data: pinnedMessages = [] } = usePinnedMessages(id as AgentSlug, organizationId)
  const togglePinMutation = useTogglePinMessage(id as AgentSlug, organizationId)
  const handleTogglePin = useCallback((message: Message) => {
    if (!message.id) return
    const prevPinned = message.pinned
    const prevPinnedAt = message.pinnedAt ?? null
    const nextPinned = !prevPinned
    setMsgWindow((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, pinned: nextPinned, pinnedAt: nextPinned ? new Date().toISOString() : null }
          : m,
      ),
    )
    togglePinMutation.mutate(
      { id: message.id, pinned: nextPinned },
      {
        onError: () => {
          setMsgWindow((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, pinned: prevPinned, pinnedAt: prevPinnedAt } : m)),
          )
          toast.error("Couldn't update pin.")
        },
      },
    )
  }, [setMsgWindow, togglePinMutation])
  const { data: rexDatasetCount = 0 } = useQuery({
    queryKey: qk.rexDatasets(organizationId),
    queryFn: () => apiFetch<{ id: string }[]>("/agents/rex/datasets"),
    select: (d) => d.length,
    enabled: id === "rex" && !!organizationId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const [toolsOpen, setToolsOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)
  const [activePrefill, setActivePrefill] = useState<Record<string, unknown> | undefined>(undefined)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [lexTab, setLexTab] = useState<"chat" | "documents">("chat")
  const [sageTab, setSageTab] = useState<"chat" | "favourites">("chat")
  const [rexTab, setRexTab] = useState<"chat" | "data">("chat")
  const [mayaTab, setMayaTab] = useState<"chat" | "published" | "plan">("chat")

  const isBusy = isLoading || actionSubmitting

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

  // Scroll a jumped-to (pinned/searched) message into view once it's in the
  // DOM, then clear the highlight after it's had a moment to register.
  useEffect(() => {
    if (!highlightedMessageId) return
    const el = chatScrollRef.current?.querySelector(`[data-message-id="${highlightedMessageId}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
    const timer = setTimeout(() => clearHighlight(), 2500)
    return () => clearTimeout(timer)
  }, [highlightedMessageId, msgWindow, clearHighlight])

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
    [],
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
    [msgWindow],
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

  /**
   * Turns one slot of the content plan into a running generator.
   *
   * A plan whose items have to be retyped into a form is a document, not a
   * tool — this is what makes it the latter. Reels go to the video generator
   * and posts to the drafter, each carrying the angle Maya already argued for.
   *
   * Prefill keys must match the defaultValue shapes in RunActionDialog; a
   * mismatch fails silently as an empty form rather than an error.
   */
  const handleCreateFromPlan = useCallback(
    (item: ContentPlanItem) => {
      if (item.format === "reel") {
        // The video form is a single free-text prompt, so the angle and the
        // detail belong in one description.
        openAction("maya:generate-video", {
          prompt: [item.hook, item.captionDirection].filter(Boolean).join(". "),
          platform: "instagram",
          aspect_ratio: "9:16",
          duration_seconds: 10,
          use_logo: false,
        })
      } else {
        // Topic is a one-line subject — it renders in a single-line input and
        // reads as the post's title. The caption direction is guidance about
        // how to treat it, which is what "Additional context" is for; pushing
        // both into topic produced an unreadable sentence in a text field.
        openAction("maya:draft-content", {
          topic: item.hook,
          additional_context: item.captionDirection,
          platforms: ["instagram"],
          word_count_target: 200,
          include_image: true,
          use_logo: true,
          use_brand_colors: true,
        })
      }
    },
    [openAction],
  )

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

  // Deep link from a pinned/searched message (ChatList's message search).
  // A search result click navigates to this same [id] route with new query
  // params rather than remounting the page, so this must react to the param
  // values themselves — not just historyLoaded — or a second search jump
  // while already on this agent's chat would silently no-op.
  const jumpParam = searchParams.get("jump")
  const atParam = searchParams.get("at")
  useEffect(() => {
    if (!historyLoaded || !jumpParam || !atParam) return
    void jumpToMessage(jumpParam, atParam)
    router.replace(`/assistants/${id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, jumpParam, atParam])

  // Return redirect from a Maya credit top-up checkout (billing.topup.ts's
  // return_url/cancel_url both point back here). Mirrors the status=success/
  // cancelled handling on settings/billing/page.tsx.
  const [toppingUp, setToppingUp] = useState(false)
  useEffect(() => {
    const topup = searchParams.get("topup")
    if (!topup) return
    if (topup === "success") {
      toast.info("Payment complete", { description: "Syncing your credits..." })
      setToppingUp(true)
    } else if (topup === "cancelled") {
      toast.info("Top-up cancelled", { description: "No charge was made." })
    }
    router.replace(`/assistants/${id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  // Polls for the top-up webhook to land instead of declaring "Credits
  // added" immediately on the redirect — the payment can be captured seconds
  // before handleMayaTopupPaymentSucceeded actually grants the credits, so an
  // instant success toast could show a stale (pre-purchase) balance. Mirrors
  // settings/billing/page.tsx's syncingCheckout poll: capped at ~30s (15 * 2s).
  useEffect(() => {
    if (!toppingUp) return
    let attempts = 0
    const interval = window.setInterval(() => {
      attempts += 1
      void getBillingStatus().then((status) => {
        const pending = status.subscription?.pendingCheckout
        if (!pending || pending.kind !== "MAYA_TOPUP") {
          setToppingUp(false)
          toast.success("Credits added", { description: "Check your balance above." })
          if (organizationId) void queryClient.invalidateQueries({ queryKey: qk.mayaUsage(organizationId) })
        } else if (attempts >= 15) {
          setToppingUp(false)
          toast.warning("Still syncing", {
            description: "This is taking longer than usual — refresh the page or contact support if it doesn't update soon.",
          })
        }
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [toppingUp, organizationId, queryClient])

  const discoverCompetitorsPrefill = useMemo(() =>
    brandKit
      ? { description: brandKit.companyDescription || "", industry: brandKit.industry || "", location: brandKit.location || "" }
      : undefined,
    [brandKit]
  )

  const handlePlusPick = (actionId: AgentActionId) => {
    setToolsOpen(false)
    if (actionId === "maya:video-templates") {
      setTemplatePickerOpen(true)
    } else if (actionId === "scout:discover-competitors") {
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
  // Normalized through getUpgradeRequiredReason so this shows the specific
  // trial/expired/not-purchased copy instead of the
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
  const hasMessages = msgWindow.length > 0
  // The streaming bubble already shows live progress (cursor + live tool
  // trace) — showing the generic three-dot indicator alongside it is redundant.
  const hasStreamingMessage = msgWindow.some((m) => m.deliveryStatus === "streaming")
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
        onPinnedClick={() => setPinnedOpen((v) => !v)}
        pinnedCount={pinnedMessages.length}
      />

      {pinnedOpen && (
        <div className="border-b border-(--vq-line-2) bg-card px-3 py-2 sm:px-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Pinned messages
            </span>
            <button
              type="button"
              onClick={() => setPinnedOpen(false)}
              aria-label="Close pinned messages"
              className="grid size-5 cursor-pointer place-items-center rounded-full border-none bg-transparent text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {pinnedMessages.length === 0 ? (
            <div className="py-2 text-center text-[12px] text-muted-foreground">
              Pin a message to find it again quickly.
            </div>
          ) : (
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {pinnedMessages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.id) void jumpToMessage(m.id, m.createdAt)
                    setPinnedOpen(false)
                  }}
                  className="cursor-pointer rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-black/5"
                >
                  <div className="truncate font-body text-[12.5px] text-foreground">
                    {m.role === "user" ? "You: " : ""}
                    {m.content || "(no text)"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isAnchored && (
        <div className="flex items-center justify-center border-b border-(--vq-line-2) bg-card py-1.5">
          <button
            type="button"
            onClick={() => void returnToLatest()}
            className="cursor-pointer rounded-full border border-(--vq-line-2) bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            Viewing history — back to latest
          </button>
        </div>
      )}

      {isLex && (
        <div className="flex flex-wrap items-center gap-2 border-b border-(--vq-line-2) bg-card px-3 py-2 sm:px-4">
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setLexTab("chat")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              lexTab === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setLexTab("documents")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              lexTab === "documents" ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground"
            )}
          >
            <FolderOpen className="size-3" /> Documents
          </button>
        </div>
      )}

      {isSage && (
        <div className="flex flex-wrap items-center gap-2 border-b border-(--vq-line-2) bg-card px-3 py-2 sm:px-4">
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setSageTab("chat")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              sageTab === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setSageTab("favourites")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              sageTab === "favourites" ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground"
            )}
          >
            <FolderOpen className="size-3" /> Favourites
          </button>
        </div>
      )}

      {isRex && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-(--vq-line-2) bg-card px-3 py-2 sm:px-4">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setRexTab("chat")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                rexTab === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <MessageSquare className="size-3" /> Chat
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setRexTab("data")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                rexTab === "data" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <FolderOpen className="size-3" /> Data
              {rexDatasetCount > 0 && (
                <span
                  className="ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] leading-none text-foreground"
                  style={{ background: rexTab === "data" ? "var(--background)" : (agent.color as string) }}
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
        <div className="flex flex-wrap items-center gap-2 border-b border-(--vq-line-2) bg-card px-3 py-2 sm:px-4">
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMayaTab("chat")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              mayaTab === "chat" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMayaTab("published")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              mayaTab === "published" ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground"
            )}
          >
            <FolderOpen className="size-3" /> Published Posts
          </button>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMayaTab("plan")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              mayaTab === "plan" ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground"
            )}
          >
            <CalendarDays className="size-3" /> Content Plan
          </button>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 max-[480px]:w-full">
            <MayaCreditsPill organizationId={organizationId} />
            <MayaTopUpButton organizationId={organizationId} />
          </div>
        </div>
      )}

      {isMaya && mayaTab === "published" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MayaPublishedPostsTab />
        </div>
      ) : isMaya && mayaTab === "plan" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <MayaContentPlanTab onCreate={handleCreateFromPlan} />
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
      ) : historyLoaded && !hasMessages && !isBusy ? (
        <EmptyState agent={agent} onPrompt={(p) => setContent(p)} />
      ) : (
        <div
          className="relative flex-1 min-h-0"
          style={{
            // The pattern lives on this wrapper, not the scroll container, so
            // it stays put while the thread scrolls over it. The flat colour
            // is the base layer so the thread reads correctly before the
            // image loads; the cream gradient on top knocks the line art back
            // so it never competes with message text.
            background: `
              linear-gradient(rgba(239,231,214,0.82), rgba(239,231,214,0.82)),
              url('/chat-bg.webp') repeat
            `,
            backgroundSize: "auto, 560px auto",
          }}
        >
          <div
            ref={chatScrollRef}
            className="h-full overflow-y-auto"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              padding: "16px 20px",
              background: "transparent",
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
              <div className="flex justify-center pb-1">
                <button
                  onClick={() => void loadPreviousPage()}
                  disabled={isLoadingPrev}
                  className={cn(
                    "rounded-full border border-(--vq-line-2) bg-card/85 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase shadow-(--vq-shadow-sm)",
                    isLoadingPrev ? "cursor-default opacity-60" : "cursor-pointer opacity-100"
                  )}
                >
                  {isLoadingPrev ? "loading…" : "↑ load older messages"}
                </button>
              </div>
            )}
            {displayMessages.map((msg, i) => (
              <div
                key={msg.id ?? `msg-${i}`}
                data-message-id={msg.id}
                className={cn(
                  "rounded-xl transition-colors duration-700",
                  msg.id && msg.id === highlightedMessageId ? "bg-(--vq-yellow)/25" : "bg-transparent",
                )}
              >
                <ChatMessage
                  message={msg}
                  agentInitials={agent.initials}
                  agentColor={agentColor}
                  agentPhoto={agentPhotoUrl}
                  showAvatar={msg.role !== "assistant" || i === 0 || displayMessages[i - 1]?.role !== "assistant"}
                  marginTop={i === 0 ? 0 : displayMessages[i - 1]?.role === msg.role ? 4 : 12}
                  onFollowUpAction={handleFollowUp}
                  onRevertImage={handleRevertImage}
                  onRestoreDraft={handleRestoreDraft}
                  onTogglePin={handleTogglePin}
                />
              </div>
            ))}
            {isBusy && !hasStreamingMessage && (
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
            className={cn(
              "absolute right-4 bottom-4 z-10 grid size-9 cursor-pointer place-items-center rounded-full border-none bg-primary text-primary-foreground shadow-(--vq-shadow-lg) transition-[opacity,transform] duration-200",
              isAtBottom ? "pointer-events-none translate-y-2 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
            )}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      )}

      <div style={{ flexShrink: 0 }}>
        {!(isLex && lexTab === "documents") &&
          !(isSage && sageTab === "favourites") &&
          !(isRex && rexTab === "data") &&
          !(isMaya && mayaTab !== "chat") && (
          <ChatInput
            value={content}
            onChange={setContent}
            onSend={handleSend}
            onToolsClick={() => setToolsOpen(true)}
            agentSlug={agentSlug}
            onPickAction={(a) => handlePlusPick(a.id)}
            onAttachClick={isLex ? openUploadAction : undefined}
            knowledgeSources={isLex ? lexSources : undefined}
            attachedSourceIds={isLex ? attachedSourceIds : undefined}
            onAttachSource={
              isLex
                ? (s) => setAttachedSourceIds((prev) => (prev.includes(s.sourceId) ? prev : [...prev, s.sourceId]))
                : undefined
            }
            onRemoveAttachedSource={
              isLex ? (sourceId) => setAttachedSourceIds((prev) => prev.filter((id) => id !== sourceId)) : undefined
            }
            placeholder={`Message ${agent.name.toLowerCase()}…`}
            disabled={isLoading}
          />
        )}
      </div>

      {infoOpen && (
        <AgentInfoPanel
          agent={agent}
          kit={brandKit}
          open
          onClose={() => setInfoOpen(false)}
          organizationId={organizationId}
        />
      )}

      {toolsOpen && (
        <ToolsMenu
          open
          onOpenChange={setToolsOpen}
          agentSlug={agentSlug}
          agentName={agent.name}
          onPick={(a) => handlePlusPick(a.id)}
        />
      )}
      {templatePickerOpen && (
        <VideoTemplatePicker
          open
          onOpenChange={setTemplatePickerOpen}
          onSelect={(template) =>
            openAction("maya:campaign-video", {
              campaign_brief: expandTemplate(template),
              template_prompt: template.promptTemplate,
              template_label: template.slashCommand,
              from_template: true,
            })
          }
        />
      )}
      {helpOpen && <HelpSheet open onOpenChange={setHelpOpen} agent={agent} />}
      {onboardOpen && (
        <OnboardMeModal
          agentSlug={agentSlug}
          agentName={agent.name}
          open
          onOpenChange={setOnboardOpen}
        />
      )}
      {activeActionId && (
        <RunActionDialog
          open
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
      )}
    </div>
    </MediaViewerProvider>
  )
}
