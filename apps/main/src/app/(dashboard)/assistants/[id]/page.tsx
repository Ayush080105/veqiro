"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { getAgent } from "@/lib/config/agents"
import {
  sendMessage,
  getMessages,
  AgentNotAvailableError,
} from "@/lib/api/assistants"
import { getBrandKit } from "@/lib/api/brain"
import { hasGoogleConnected } from "@/lib/api/auth-accounts"
import { ScrollArea } from "@/components/ui/scroll-area"

import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { PlusMenu } from "@/components/chat/PlusMenu"
import { HelpSheet } from "@/components/chat/HelpSheet"
import { RunActionDialog } from "@/components/chat/RunActionDialog"
import type { ActionResultContext } from "@/components/chat/ActionDialog"

import { FONT, Button as VqButton, Sticker } from "@/components/veqiro/shared"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"

import type {
  Message,
  AgentConfig,
  AgentSlug,
  BrandKit,
} from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"

// ─── Header strip ────────────────────────────────────────────────────────────

function AgentHeader({ agent }: { agent: AgentConfig }) {
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  return (
    <div
      style={{
        background: agent.color,
        borderBottom: "3px solid #111",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid #111",
          background: "#FFF9ED",
          flexShrink: 0,
          boxShadow: "3px 3px 0 #111",
        }}
      >
        {Portrait ? <Portrait size={48} /> : (
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
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT.head,
            fontSize: 16,
            color: "#111",
            letterSpacing: -0.3,
          }}
        >
          {agent.name} <span style={{ opacity: 0.6 }}>·</span> {agent.role}
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
      </div>
      <Link
        href="/assistants"
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#111",
          textDecoration: "none",
          padding: "8px 12px",
          border: "2px solid #111",
          borderRadius: 999,
          background: "#FFF9ED",
          boxShadow: "2px 2px 0 #111",
        }}
      >
        ← team
      </Link>
    </div>
  )
}

// ─── Context strip ───────────────────────────────────────────────────────────

function ContextStrip({ kit }: { kit: BrandKit | null }) {
  if (!kit || !kit.company_name) return null
  const swatches = [
    kit.brand_colors?.primary,
    kit.brand_colors?.secondary,
    kit.brand_colors?.accent,
  ].filter(Boolean) as string[]

  const bits: { k: string; v: string }[] = []
  if (kit.company_name) bits.push({ k: "brand", v: kit.company_name })
  if (kit.industry) bits.push({ k: "industry", v: kit.industry })
  if (kit.brand_voice) bits.push({ k: "voice", v: kit.brand_voice })

  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "2px dashed #111",
        margin: "12px 16px 0",
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 14,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#111",
          opacity: 0.75,
        }}
      >
        CONTEXT:
      </span>
      {bits.map((b) => (
        <span
          key={b.k}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 0.5,
            color: "#111",
            display: "inline-flex",
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.5 }}>{b.k}:</span>
          <span style={{ fontWeight: 600 }}>{b.v}</span>
        </span>
      ))}
      {swatches.length > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#111",
              opacity: 0.55,
            }}
          >
            palette
          </span>
          {swatches.map((c, i) => (
            <span
              key={i}
              title={c}
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: c,
                border: "1.5px solid #111",
                display: "inline-block",
              }}
            />
          ))}
        </span>
      )}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

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
          <Sticker rot={-6} color={agent.color as string}>
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
          {Portrait ? <Portrait size={140} /> : (
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

// ─── Left rail ───────────────────────────────────────────────────────────────

function LeftRail({ agent }: { agent: AgentConfig }) {
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "#FFF9ED",
        borderRight: "3px solid #111",
        overflow: "auto",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          background: agent.color,
          border: "3px solid #111",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "6px 6px 0 #111",
          transform: "rotate(-1.5deg)",
        }}
      >
        {Portrait ? <Portrait size="100%" /> : null}
      </div>

      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
          }}
        >
          {agent.role}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 44,
            lineHeight: 1,
            color: "#111",
            letterSpacing: -1,
            marginTop: 2,
          }}
        >
          {agent.name.toLowerCase()}
        </div>
      </div>

      <p
        style={{
          fontFamily: FONT.body,
          fontSize: 14,
          lineHeight: 1.5,
          color: "#333",
          margin: 0,
          fontStyle: "italic",
        }}
      >
        &ldquo;{agent.tag}&rdquo;
      </p>

      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
            marginBottom: 8,
          }}
        >
          specialties
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {agent.specialties.map((s) => (
            <span
              key={s}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                padding: "4px 10px",
                background: "#fff",
                border: "2px solid #111",
                borderRadius: 999,
                color: "#111",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
            marginBottom: 8,
          }}
        >
          stats
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {agent.stats.map((s) => (
            <div
              key={s.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "6px 10px",
                background: "#fff",
                border: "2px solid #111",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#555",
                }}
              >
                {s.k}
              </span>
              <span
                style={{
                  fontFamily: FONT.head,
                  fontSize: 13,
                  color: "#111",
                }}
              >
                {s.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function genConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AssistantChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const agent = getAgent(id)

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)

  const [plusOpen, setPlusOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null)

  const conversationIdRef = useRef<string>(genConversationId())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!agent) router.push("/assistants")
  }, [agent, router])

  useEffect(() => {
    if (!agent || !organizationId) return
    getMessages(id, organizationId)
      .then((msgs) => {
        setMessages(msgs)
        setHistoryLoaded(true)
      })
      .catch(() => setHistoryLoaded(true))
  }, [id, organizationId, agent])

  useEffect(() => {
    if (!organizationId) return
    getBrandKit(organizationId).then((k) => setBrandKit(k))
  }, [organizationId])

  useEffect(() => {
    if (agent?.id !== "vega") return
    let cancelled = false
    hasGoogleConnected()
      .then((ok) => {
        if (!cancelled) setGoogleLinked(ok)
      })
      .catch(() => {
        if (!cancelled) setGoogleLinked(false)
      })
    return () => {
      cancelled = true
    }
  }, [agent?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 1000 || isLoading) return

    const userMsg: Message = {
      role: "user",
      content: trimmed,
      imageUrl: null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setContent("")
    setIsLoading(true)

    try {
      const response = await sendMessage(
        id,
        organizationId,
        trimmed,
        conversationIdRef.current
      )
      setMessages((prev) => [...prev, response])
    } catch (err) {
      if (err instanceof AgentNotAvailableError) {
        toast.error(
          `${agent?.name ?? "This agent"} isn't connected yet — backend route is being set up. Try again soon.`
        )
      } else {
        toast.error("Failed to send message. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [content, id, isLoading, organizationId, agent])

  const handleActionComplete = useCallback(
    (ctx: ActionResultContext<unknown, unknown>) => {
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
      setMessages((prev) => [...prev, msg])
      toast.success(meta ? `${meta.label} complete.` : "Action complete.")
    },
    []
  )

  const openAction = (actionId: AgentActionId) => {
    setActiveActionId(actionId)
  }

  const handlePlusPick = (actionId: AgentActionId) => {
    setPlusOpen(false)
    openAction(actionId)
  }

  const agentColor = useMemo(() => agent?.color ?? "var(--vq-yellow)", [agent])

  if (!agent) return null

  const isLex = agent.id === "lex"
  const isVega = agent.id === "vega"
  const hasMessages = messages.length > 0
  const agentSlug = agent.id as AgentSlug

  return (
    <div
      className="-m-4"
      style={{
        display: "flex",
        height: "calc(100vh - 3rem)",
        overflow: "hidden",
        background: "#EFE7D6",
      }}
    >
      <LeftRail agent={agent} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AgentHeader agent={agent} />
        <ContextStrip kit={brandKit} />

        {historyLoaded && !hasMessages ? (
          <EmptyState agent={agent} onPrompt={(p) => setContent(p)} />
        ) : (
          <ScrollArea className="flex-1">
            <div
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
                />
              ))}
              {isLoading && (
                <TypingIndicator
                  agentInitials={agent.initials}
                  agentColor={agentColor}
                />
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
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
              <VqButton
                variant="dark"
                onClick={() => {
                  authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/assistants/vega",
                  })
                }}
              >
                Connect Google
              </VqButton>
            </div>
          )}

          <ChatInput
            value={content}
            onChange={setContent}
            onSend={handleSend}
            onPlusClick={() => setPlusOpen(true)}
            onHelpClick={() => setHelpOpen(true)}
            onAttachClick={isLex ? () => openAction("lex:ingest-document") : undefined}
            placeholder={`Message ${agent.name.toLowerCase()}…`}
            disabled={isLoading}
          />
        </div>
      </div>

      <PlusMenu
        open={plusOpen}
        onOpenChange={setPlusOpen}
        agentSlug={agentSlug}
        agentName={agent.name}
        onPick={(a) => handlePlusPick(a.id)}
      />
      <HelpSheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        agent={agent}
      />
      <RunActionDialog
        open={!!activeActionId}
        onOpenChange={(v) => !v && setActiveActionId(null)}
        actionId={activeActionId}
        organizationId={organizationId}
        conversationId={conversationIdRef.current}
        onComplete={handleActionComplete}
      />
    </div>
  )
}
