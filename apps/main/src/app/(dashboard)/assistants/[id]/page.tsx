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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import { ChatInput } from "@/components/chat/ChatInput"
import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { PlusMenu } from "@/components/chat/PlusMenu"
import { HelpSheet } from "@/components/chat/HelpSheet"
import { RunActionDialog } from "@/components/chat/RunActionDialog"
import type { ActionResultContext } from "@/components/chat/ActionDialog"

import type { Message, AgentStatus, AgentConfig, AgentSlug } from "@/lib/types"
import type { AgentActionId } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"

// ─── Suggested prompts per agent ─────────────────────────────────────────────

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  maya: ["Draft a LinkedIn post", "Create a tweet thread", "Write blog intro"],
  rex: ["Analyze my MRR", "What's my burn rate?", "Forecast next quarter"],
  scout: ["Research a competitor", "Find market trends", "Find me leads"],
  sage: ["Keyword research", "Generate a blog post", "Audit my content"],
  lex: ["Review this contract", "Draft an NDA", "Explain this clause"],
  vega: ["Triage my inbox", "Schedule a meeting", "Write a briefing"],
}

function StatusIndicator({ status }: { status?: AgentStatus }) {
  if (status === "working") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-chart-2" />
        <span className="text-xs text-muted-foreground">Working</span>
      </div>
    )
  }
  if (status === "needs-attention") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
        <span className="text-xs text-muted-foreground">Needs attention</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-chart-1" />
      <span className="text-xs text-muted-foreground">Ready</span>
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
  const prompts = SUGGESTED_PROMPTS[agent.id] ?? []
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <Avatar className="size-20 text-xl font-semibold">
          <AvatarFallback
            style={{
              backgroundColor: `hsl(var(--${agent.color}))`,
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {agent.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">
            Start a conversation with {agent.name}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {agent.description}
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {agent.specialties.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {prompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => onPrompt(prompt)}
            >
              {prompt}
            </Button>
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
  const agent = getAgent(id)

  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const [plusOpen, setPlusOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [activeActionId, setActiveActionId] = useState<AgentActionId | null>(null)

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

  if (!agent) return null

  const isLex = agent.id === "lex"
  const isVega = agent.id === "vega"
  const hasMessages = messages.length > 0
  const agentSlug = agent.id as AgentSlug

  return (
    <div className="-m-4 flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* ── Left panel: Agent profile ─────────────────────────────────────── */}
      <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4">
        <div className="flex flex-col items-center gap-3 pt-2">
          <Avatar className="size-16 text-base font-semibold">
            <AvatarFallback
              style={{
                backgroundColor: `hsl(var(--${agent.color}))`,
                color: "hsl(var(--primary-foreground))",
              }}
            >
              {agent.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-sm font-semibold text-foreground">{agent.name}</h2>
            <Badge variant="secondary">{agent.role}</Badge>
          </div>
          <StatusIndicator />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">
            Specialties
          </p>
          <div className="flex flex-wrap gap-1">
            {agent.specialties.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {agent.description}
        </p>

        <div className="mt-auto pt-4">
          <Link
            href="/assistants"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; Back to team
          </Link>
        </div>
      </aside>

      {/* ── Right panel: Chat ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {historyLoaded && !hasMessages ? (
          <EmptyState agent={agent} onPrompt={(p) => setContent(p)} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-4 p-4">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id ?? `msg-${i}`}
                  message={msg}
                  agentInitials={agent.initials}
                  isLex={isLex}
                />
              ))}
              {isLoading && <TypingIndicator agentInitials={agent.initials} />}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t border-border bg-background">
          {isVega && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2">
              <p className="text-xs text-muted-foreground">
                Connect Google Calendar to let Vega schedule meetings on your behalf.
              </p>
              <Link href="/settings/integrations">
                <Button variant="outline" size="sm">
                  Connect Google
                </Button>
              </Link>
            </div>
          )}

          <ChatInput
            value={content}
            onChange={setContent}
            onSend={handleSend}
            onPlusClick={() => setPlusOpen(true)}
            onHelpClick={() => setHelpOpen(true)}
            onAttachClick={isLex ? () => openAction("lex:ingest-document") : undefined}
            placeholder={`Message ${agent.name}…`}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
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
