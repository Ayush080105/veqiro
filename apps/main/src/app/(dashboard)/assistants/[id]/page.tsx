"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info, HelpCircle, MessageSquare, FolderOpen, Rocket } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { apiFetch, ApiError } from "@/lib/api/client"
import { getAgent } from "@/lib/config/agents"
import {
  useMessages,
  useSendMessage,
  AgentNotAvailableError,
} from "@/lib/api/assistants"
import { useBrandKit } from "@/lib/api/brain"
import { useGoogleConnected } from "@/lib/api/auth-accounts"
import { qk } from "@/lib/query-keys"

import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { PlusMenu } from "@/components/chat/PlusMenu"
import { HelpSheet } from "@/components/chat/HelpSheet"
import { RunActionDialog } from "@/components/chat/RunActionDialog"
import type { ActionResultContext, ActionStartContext } from "@/components/chat/ActionDialog"
import { LexDocumentsTab } from "@/components/agents/lex/documents-tab"
import { ScoutWatchlistTab } from "@/components/agents/scout/watchlist-tab"
import { SageSavedKeywordsTab } from "@/components/agents/sage/saved-keywords-tab"
import { RexDataTab, REX_DATASETS_KEY } from "@/components/agents/rex/data-tab"
import { KpiStrip } from "@/components/agents/rex/KpiStrip"
import { TodayPanel } from "@/components/agents/rex/today-panel"
import { MagicNumbers } from "@/components/agents/rex/magic-numbers"
import { MayaPublishedPostsTab } from "@/components/agents/maya/published-posts-tab"
import type { LexSource, SageSavedKeyword } from "@/lib/types/agents"

import AgentInfoPanel from "@/components/assistants/AgentInfoPanel"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { FONT } from "@/lib/fonts"
import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/ui/sticker"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"

import type {
  Message,
  AgentConfig,
  AgentSlug,
} from "@/lib/types"
import type { AgentActionId, MayaDraftResult, MayaImageRegenResult, MayaVariantResult, ImageResult } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"

function ChatHeader({
  agent,
  onInfoClick,
  onHelpClick,
}: {
  agent: AgentConfig
  onInfoClick: () => void
  onHelpClick: () => void
}) {
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  return (
    <div
      style={{
        background: agent.color,
        borderBottom: "3px solid #111",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <button
        type="button"
        onClick={onInfoClick}
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid #111",
          background: "#FFF9ED",
          flexShrink: 0,
          boxShadow: "3px 3px 0 #111",
          cursor: "pointer",
          padding: 0,
        }}
        aria-label="Agent info"
      >
        {Portrait ? (
          <Portrait size={44} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              fontFamily: FONT.head,
              fontSize: 14,
              color: "#111",
            }}
          >
            {agent.initials}
          </div>
        )}
      </button>
      <button
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
        <div
          style={{
            fontFamily: FONT.head,
            fontSize: 16,
            color: "#111",
            letterSpacing: -0.3,
          }}
        >
          {agent.name}{" "}
          <span style={{ opacity: 0.6 }}>·</span> {agent.role}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#111",
            opacity: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#1DBC87",
              boxShadow: "0 0 0 2px #111",
              display: "inline-block",
            }}
          />
          online · ready to work
        </div>
      </button>
      <button
        type="button"
        onClick={onHelpClick}
        aria-label="Help"
        style={{
          background: "#FFF9ED",
          border: "2px solid #111",
          borderRadius: 999,
          padding: 8,
          cursor: "pointer",
          boxShadow: "2px 2px 0 #111",
          display: "grid",
          placeItems: "center",
        }}
      >
        <HelpCircle className="size-4" />
      </button>
      <button
        type="button"
        onClick={onInfoClick}
        aria-label="Agent info"
        style={{
          background: "#FFF9ED",
          border: "2px solid #111",
          borderRadius: 999,
          padding: 8,
          cursor: "pointer",
          boxShadow: "2px 2px 0 #111",
          display: "grid",
          placeItems: "center",
        }}
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
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
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
        <div style={{ position: "absolute", top: -8, left: 20 }}>
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
            border: "3px solid #111",
            boxShadow: "8px 8px 0 #111",
            background: agent.color,
            transform: "rotate(-2deg)",
          }}
        >
          {Portrait ? (
            <Portrait size={140} />
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
              key={prompt}
              onClick={() => onPrompt(prompt)}
              style={{
                fontFamily: FONT.body,
                fontSize: 13,
                padding: "10px 14px",
                background: "#FFF9ED",
                border: "2.5px solid #111",
                borderRadius: 999,
                boxShadow: "3px 3px 0 #111",
                cursor: "pointer",
                color: "#111",
                transition: "transform 120ms ease",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translate(2px,2px)"
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translate(0,0)"
              }}
              onMouseLeave={(e) => {
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
  const queryClient = useQueryClient()
  const agent = getAgent(id)

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const { data: messages = [], isPending: messagesPending, isError: messagesError, error: messagesErrorObj } = useMessages(
    id,
    organizationId,
  )
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
  const [infoOpen, setInfoOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)
  const [activePrefill, setActivePrefill] = useState<Record<string, unknown> | undefined>(undefined)
  const [pendingActionCount, setPendingActionCount] = useState(0)
  const [lexTab, setLexTab] = useState<"chat" | "documents">("chat")
  const [scoutTab, setScoutTab] = useState<"chat" | "watchlist">("chat")
  const [sageTab, setSageTab] = useState<"chat" | "favourites">("chat")
  const [rexTab, setRexTab] = useState<"chat" | "data">("chat")
  const [mayaTab, setMayaTab] = useState<"chat" | "published">("chat")

  const conversationIdRef = useRef<string>(genConversationId())
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const scrollFrameRef = useRef<number | null>(null)

  const sendMutation = useSendMessage(id, organizationId, conversationIdRef.current)
  const isLoading = sendMutation.isPending
  const isBusy = isLoading || pendingActionCount > 0
  const historyLoaded = !messagesPending

  useEffect(() => {
    if (!agent) router.push("/assistants")
  }, [agent, router])

  useEffect(() => {
    if (scrollFrameRef.current != null) {
      cancelAnimationFrame(scrollFrameRef.current)
    }
    scrollFrameRef.current = requestAnimationFrame(() => {
      const el = chatScrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    })
    return () => {
      if (scrollFrameRef.current != null) {
        cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [messages.length, isBusy])

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

  const handleActionStart = useCallback(
    (ctx: ActionStartContext<unknown>) => {
      const meta = findAction(ctx.actionId)
      const msg: Message = {
        role: "user",
        content: `Run: ${meta?.label ?? "Action"}`,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        customInput: { actionId: ctx.actionId, input: ctx.input },
      }
      setPendingActionCount((count) => count + 1)
      void queryClient.cancelQueries({ queryKey: qk.chat(id, organizationId) })
      queryClient.setQueryData<Message[]>(
        qk.chat(id, organizationId),
        (prev) => [...(prev ?? []), msg],
      )
    },
    [queryClient, id, organizationId],
  )

  const handleActionSettled = useCallback(() => {
    setPendingActionCount((count) => Math.max(0, count - 1))
  }, [])

  const handleActionComplete = useCallback(
    (ctx: ActionResultContext<unknown, unknown>) => {
      if (ctx.actionId === "maya:regenerate-image") {
        const regenResult = ctx.result as MayaImageRegenResult
        queryClient.setQueryData<Message[]>(qk.chat(id, organizationId), (prev) => {
          if (!prev) return prev
          const msgs = [...prev]
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i]
            if (m.customInput?.actionId === "maya:draft-content") {
              const r = m.customInput.result as MayaDraftResult
              msgs[i] = {
                ...m,
                customInput: {
                  ...m.customInput,
                  result: { ...r, _previousImage: r.image ?? null, image: regenResult.image },
                },
              }
              break
            }
          }
          return msgs
        })
        toast.success("Image regenerated.")
        return
      }

      if (ctx.actionId === "maya:generate-variants") {
        const serverResult = ctx.result as MayaVariantResult
        let originalImage: ImageResult | null = null
        const msgs = queryClient.getQueryData<Message[]>(qk.chat(id, organizationId)) ?? []
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].customInput?.actionId === "maya:draft-content") {
            originalImage = (msgs[i].customInput!.result as MayaDraftResult)?.image ?? null
            break
          }
        }
        const enrichedResult: MayaVariantResult = { ...serverResult, _originalImage: originalImage }
        const meta = findAction(ctx.actionId)
        const msg: Message = {
          role: "assistant",
          content: meta ? `${meta.label} — done.` : "Action complete.",
          imageUrl: null,
          createdAt: new Date().toISOString(),
          customInput: { actionId: ctx.actionId, input: ctx.input, result: enrichedResult },
        }
        queryClient.setQueryData<Message[]>(qk.chat(id, organizationId), (prev) => [...(prev ?? []), msg])
        toast.success(meta ? `${meta.label} complete.` : "Action complete.")
        return
      }

      const meta = findAction(ctx.actionId)
      const msg: Message = {
        role: "assistant",
        content: meta ? `${meta.label} — done.` : "Action complete.",
        imageUrl: null,
        createdAt: new Date().toISOString(),
        customInput: {
          actionId: ctx.actionId,
          input: ctx.input,
          result: ctx.result,
        },
      }
      queryClient.setQueryData<Message[]>(
        qk.chat(id, organizationId),
        (prev) => [...(prev ?? []), msg],
      )
      toast.success(meta ? `${meta.label} complete.` : "Action complete.")
    },
    [queryClient, id, organizationId],
  )

  const handleRevertImage = useCallback(
    (msgIndex: number) => {
      queryClient.setQueryData<Message[]>(qk.chat(id, organizationId), (prev) => {
        if (!prev || msgIndex >= prev.length) return prev
        const msgs = [...prev]
        const m = msgs[msgIndex]
        const r = m.customInput?.result as MayaDraftResult | undefined
        if (!r?._previousImage) return prev
        msgs[msgIndex] = {
          ...m,
          customInput: {
            ...m.customInput!,
            result: { ...r, image: r._previousImage, _previousImage: null },
          },
        }
        return msgs
      })
    },
    [queryClient, id, organizationId],
  )

  const searchParams = useSearchParams()

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
    [id, openAction, router]
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

  const discoverCompetitorsPrefill = useMemo(() =>
    brandKit
      ? { description: brandKit.companyDescription || "", industry: brandKit.industry || "" }
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
  }, [])

  const openQueryForSource = useCallback((source: LexSource) => {
    setLexTab("chat")
    openAction("lex:query-document", { sourceId: source.sourceId })
  }, [])

  const openUploadAction = useCallback(() => {
    setLexTab("chat")
    openAction("lex:upload-source")
  }, [])

  const openCampaignAction = useCallback(() => {
    openAction("maya:campaign")
  }, [])

  const agentColor = useMemo(() => agent?.color ?? "var(--vq-yellow)", [agent])

  if (!agent) return null

  // Surface entitlement gate: messages fetch returned 402, or a send attempt hit 402
  const upgradeError =
    (messagesError && messagesErrorObj instanceof ApiError && messagesErrorObj.status === 402
      ? messagesErrorObj
      : null) ?? sendError
  if (upgradeError) {
    return <UpgradeRequiredCard reason={upgradeError.code} />
  }

  const isLex = agent.id === "lex"
  const isScout = agent.id === "scout"
  const isSage = agent.id === "sage"
  const isRex = agent.id === "rex"
  const isMaya = agent.id === "maya"
  const isVega = agent.id === "vega"
  const hasMessages = messages.length > 0
  const agentSlug = agent.id as AgentSlug

  return (
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
      />

      {isLex && (
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
            type="button"
            onClick={() => setLexTab("chat")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              lexTab === "chat" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setLexTab("documents")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              lexTab === "documents"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Documents
          </button>
        </div>
      )}

      {isScout && (
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
            type="button"
            onClick={() => setScoutTab("chat")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              scoutTab === "chat" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setScoutTab("watchlist")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              scoutTab === "watchlist"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Watchlist
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
            borderBottom: "2px solid #111",
            background: "#FFF9ED",
          }}
        >
          <button
            type="button"
            onClick={() => setSageTab("chat")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              sageTab === "chat" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setSageTab("favourites")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
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
              type="button"
              onClick={() => setRexTab("chat")}
              className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
                rexTab === "chat" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
              }`}
            >
              <MessageSquare className="size-3" /> Chat
            </button>
            <button
              type="button"
              onClick={() => setRexTab("data")}
              className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
                rexTab === "data" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
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
          <KpiStrip onOpenDataTab={() => setRexTab("data")} />
          <MagicNumbers organizationId={organizationId} />
          <TodayPanel organizationId={organizationId} />
        </>
      )}

      {isMaya && (
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
            type="button"
            onClick={() => setMayaTab("chat")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              mayaTab === "chat" ? "bg-[#111] text-white" : "bg-transparent text-[#111]"
            }`}
          >
            <MessageSquare className="size-3" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setMayaTab("published")}
            className={`flex items-center gap-1.5 border-2 border-[#111] px-3 py-1 text-xs ${
              mayaTab === "published"
                ? "bg-[#111] text-white"
                : "bg-transparent text-[#111]"
            }`}
          >
            <FolderOpen className="size-3" /> Published Posts
          </button>
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
      ) : isScout && scoutTab === "watchlist" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ScoutWatchlistTab
            onDiscover={() => {
              setScoutTab("chat")
              openAction("scout:discover-competitors", discoverCompetitorsPrefill)
            }}
            onResearch={(name, url) => {
              setScoutTab("chat")
              openAction("scout:research-company", { company_name: name, company_url: url })
            }}
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
          />
        </div>
      ) : historyLoaded && !hasMessages && !isBusy ? (
        <EmptyState agent={agent} onPrompt={(p) => setContent(p)} />
      ) : (
        <div
          ref={chatScrollRef}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: "20px 24px",
          }}
        >
          {messages.map((msg, i) => (
            <ChatMessage
              key={msg.id ?? `msg-${i}`}
              message={msg}
              agentName={agent.name}
              agentInitials={agent.initials}
              agentColor={agentColor}
              isLex={isLex}
              onFollowUpAction={handleFollowUp}
              onRevertImage={() => handleRevertImage(i)}
            />
          ))}
          {isBusy && (
            <TypingIndicator
              agentInitials={agent.initials}
              agentColor={agentColor}
            />
          )}
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
              background: "#FFF9ED",
              borderTop: "3px solid #111",
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

        {!(isLex && lexTab === "documents") && !(isScout && scoutTab === "watchlist") && !(isSage && sageTab === "favourites") && !(isRex && rexTab === "data") && !(isMaya && mayaTab === "published") && (
          <ChatInput
            value={content}
            onChange={setContent}
            onSend={handleSend}
            onPlusClick={() => setPlusOpen(true)}
            onHelpClick={() => setHelpOpen(true)}
            onAttachClick={isLex ? openUploadAction : isMaya ? openCampaignAction : undefined}
            attachIcon={isMaya ? <Rocket className="size-4" /> : undefined}
            attachTitle={isMaya ? "Create Product Campaign" : undefined}
            placeholder={`Message ${agent.name.toLowerCase()}…`}
            disabled={isLoading}
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
        onSettled={handleActionSettled}
        onComplete={handleActionComplete}
      />
    </div>
  )
}
