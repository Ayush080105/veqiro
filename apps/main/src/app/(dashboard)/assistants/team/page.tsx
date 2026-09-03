"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Send, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

import { ChatMessage, TypingIndicator } from "@/components/chat/ChatMessage"
import { AGENT_PHOTOS, getAgent } from "@/lib/config/agents"
import { FONT } from "@/lib/fonts"
import { useTeam, useTeamMessages, useSendTeamMessage } from "@/lib/api/team"
import { authClient } from "@/lib/auth-client"
import type { Message } from "@/lib/types"

/**
 * The shared team room.
 *
 * One thread where every agent the org is entitled to can be assigned work by
 * the planner. Deliberately reuses ChatMessage, so a planned run renders the
 * same task graph here as it does in an individual chat.
 */
export default function TeamPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id

  const { data: team, isLoading: teamLoading } = useTeam()
  const { data: history, isLoading: historyLoading } = useTeamMessages(organizationId)
  const send = useSendTeamMessage(organizationId)

  const [content, setContent] = useState("")
  const [pending, setPending] = useState<Message[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Server returns newest-first for pagination; the thread reads oldest-first.
  const messages = useMemo(
    () => [...(history ?? [])].reverse().concat(pending),
    [history, pending],
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, send.isPending])

  const agents = team?.agents ?? []
  const enoughForATeam = agents.length >= 2

  const submit = async () => {
    const text = content.trim()
    if (!text || send.isPending) return
    setContent("")
    // Optimistic echo so the room does not look frozen during planning, which
    // takes a few seconds longer than an ordinary turn.
    setPending([
      {
        role: "user",
        content: text,
        imageUrl: null,
        createdAt: new Date().toISOString(),
      } as Message,
    ])
    try {
      await send.mutateAsync(text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the team")
      setContent(text)
    } finally {
      setPending([])
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#EFE7D6" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px",
          borderBottom: "1px solid #D4C9B0",
          background: "#FFF9ED",
        }}
      >
        <div style={{ display: "flex", flexShrink: 0 }}>
          {agents.slice(0, 6).map((slug, i) => (
            <span
              key={slug}
              title={getAgent(slug.toLowerCase())?.name ?? slug}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid #FFF9ED",
                marginLeft: i === 0 ? 0 : -11,
                background: (getAgent(slug.toLowerCase())?.color as string) ?? "#EFE7D6",
                display: "block",
              }}
            >
              {AGENT_PHOTOS[slug.toLowerCase()] && (
                <Image
                  src={AGENT_PHOTOS[slug.toLowerCase()]}
                  alt=""
                  width={64}
                  height={64}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </span>
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 17, color: "#111" }}>
            Team
          </div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 1 }}>
            {teamLoading
              ? "…"
              : enoughForATeam
                ? `${agents.map((a) => getAgent(a.toLowerCase())?.name ?? a).join(", ")}`
                : "Not enough agents yet"}
          </div>
        </div>
      </div>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        style={{
          background: `
            linear-gradient(rgba(239,231,214,0.82), rgba(239,231,214,0.82)),
            url('/chat-bg.webp') repeat
          `,
          backgroundSize: "auto, 560px auto",
        }}
      >
        {!enoughForATeam && !teamLoading ? (
          <EmptyTeam count={agents.length} />
        ) : historyLoading ? (
          <div style={{ display: "flex", gap: 8, color: "#888", fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading the room…
          </div>
        ) : messages.length === 0 ? (
          <EmptyThread />
        ) : (
          messages.map((m, i) => {
            // Unlike a per-agent chat, the speaker changes per message here.
            const cfg = getAgent((m.agent ?? team?.lead ?? "vega").toLowerCase())
            return (
              <ChatMessage
                key={m.id ?? `pending-${i}`}
                message={m}
                agentInitials={cfg?.initials ?? "T"}
                agentColor={(cfg?.color as string) ?? "var(--vq-yellow)"}
                agentPhoto={AGENT_PHOTOS[(m.agent ?? "").toLowerCase()]}
              />
            )
          })
        )}
        {send.isPending && (
          <TypingIndicator
            agentInitials={getAgent((team?.lead ?? "vega").toLowerCase())?.initials ?? "T"}
            agentColor={(getAgent((team?.lead ?? "vega").toLowerCase())?.color as string) ?? undefined}
            agentPhoto={AGENT_PHOTOS[(team?.lead ?? "vega").toLowerCase()]}
          />
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: "12px 20px 16px", background: "#EFE7D6" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#FFF9ED",
            border: "1px solid #D4C9B0",
            borderRadius: 999,
            padding: "8px 8px 8px 18px",
            opacity: enoughForATeam ? 1 : 0.5,
          }}
        >
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            disabled={!enoughForATeam || send.isPending}
            placeholder={
              enoughForATeam
                ? "Give the team something that spans a few of them…"
                : "Hire another agent to use the team room"
            }
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "#111",
            }}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!enoughForATeam || send.isPending || !content.trim()}
            aria-label="Send"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "#14120E",
              color: "#F2ECE0",
              display: "grid",
              placeItems: "center",
              cursor: content.trim() && enoughForATeam ? "pointer" : "not-allowed",
              opacity: content.trim() && enoughForATeam ? 1 : 0.4,
            }}
          >
            {send.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyTeam({ count }: { count: number }) {
  return (
    <div style={{ maxWidth: 460, margin: "48px auto", textAlign: "center" }}>
      <Users size={28} style={{ color: "#B9AE97", margin: "0 auto 12px" }} />
      <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 18, color: "#111" }}>
        The team room needs at least two agents
      </div>
      <p style={{ fontSize: 13.5, color: "#777", lineHeight: 1.6, marginTop: 8 }}>
        {count === 1
          ? "You have one agent. Hire another and they can work a single task together, each using their own connected tools."
          : "Hire a couple of agents and they can work a single task together, each using their own connected tools."}
      </p>
      <Link
        href="/settings/billing"
        style={{
          display: "inline-block",
          marginTop: 14,
          background: "#14120E",
          color: "#F2ECE0",
          borderRadius: 9,
          padding: "9px 18px",
          fontSize: 13.5,
          fontWeight: 550,
          textDecoration: "none",
        }}
      >
        See agents
      </Link>
    </div>
  )
}

function EmptyThread() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 480,
        margin: "40px auto",
        paddingInline: 4,
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: FONT.head, fontWeight: 700, fontSize: 17, color: "#111" }}>
        Give the whole team one job
      </div>
      <p style={{ fontSize: 13.5, color: "#777", lineHeight: 1.6, marginTop: 8 }}>
        Ask for something that needs more than one of them. They&apos;ll plan it
        out as a set of steps for you to approve before anything runs.
      </p>
      <div style={{ marginTop: 14, display: "grid", gap: 8, textAlign: "left" }}>
        {[
          "Research what competitors shipped this month and draft a post about how we differ",
          "Pull last quarter's numbers, check the contract terms, and summarise the risks",
        ].map((p) => (
          <div
            key={p}
            style={{
              background: "#FFF9ED",
              border: "1px solid #E5DCC8",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              color: "#555",
            }}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}
