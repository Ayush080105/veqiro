"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search } from "lucide-react"
import { useMutationState } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { useAgentStatuses, useLastMessages } from "@/lib/api/assistants"
import { stripMarkdown } from "@/lib/utils"
const AGENT_PHOTOS: Record<string, string> = {
  maya:  "/agents/maya.jpeg",
  rex:   "/agents/rex.jpeg",
  sage:  "/agents/sage.jpeg",
  scout: "/agents/scout.jpeg",
  lex:   "/agents/lex.jpeg",
  vega:  "/agents/vega.jpeg",
}
import { FONT } from "@/lib/fonts"
import type {
  AgentStatusData,
  AgentConfig,
  LastMessage,
} from "@/lib/types"

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes vq-blink {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        .vq-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #333; margin: 0 1.5px; animation: vq-blink 1.2s infinite ease-in-out; }
        .vq-dot:nth-child(2) { animation-delay: 0.2s; }
        .vq-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        <span className="vq-dot" />
        <span className="vq-dot" />
        <span className="vq-dot" />
      </span>
    </>
  )
}

const STATUS_DOT: Record<AgentStatusData["status"], string> = {
  working: "#F5C518",
  idle: "#1DBC87",
  "needs-attention": "#F06464",
}

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function previewLine(
  last: LastMessage | null,
  fallback: string | undefined,
): string {
  if (last) {
    const prefix = last.role === "user" ? "You: " : ""
    return `${prefix}${stripMarkdown(last.content)}`.replace(/\s+/g, " ").trim()
  }
  return fallback ?? "No messages yet"
}

function useUnreadTracker(
  lastMap: Record<string, LastMessage | null> | undefined,
  pathname: string,
): Set<string> {
  const [unreadSet, setUnreadSet] = useState<Set<string>>(new Set())

  // Mark current agent as read when pathname changes to /assistants/[id]
  useEffect(() => {
    const match = pathname.match(/^\/assistants\/(\w+)$/)
    if (!match) return
    const id = match[1]
    try {
      localStorage.setItem(`vq.lastRead.${id}`, String(Date.now()))
    } catch {}
    setUnreadSet((prev) => {
      const s = new Set(prev)
      s.delete(id)
      return s
    })
  }, [pathname])

  // Recompute unread set whenever lastMap updates
  useEffect(() => {
    if (!lastMap) return
    const unread = new Set<string>()
    for (const [id, msg] of Object.entries(lastMap)) {
      if (!msg || msg.role !== "assistant") continue
      try {
        const lastRead = Number(localStorage.getItem(`vq.lastRead.${id}`) ?? 0)
        if (new Date(msg.createdAt).getTime() > lastRead) unread.add(id)
      } catch {}
    }
    setUnreadSet(unread)
  }, [lastMap])

  return unreadSet
}

function AgentRow({
  agent,
  active,
  status,
  last,
  isTyping,
  unread,
}: {
  agent: AgentConfig
  active: boolean
  status: AgentStatusData | undefined
  last: LastMessage | null
  isTyping: boolean
  unread: boolean
}) {
  const photo = AGENT_PHOTOS[agent.id]
  const dot = isTyping ? "#F5C518" : STATUS_DOT[status?.status ?? "idle"]
  const preview = previewLine(last, status?.lastActivity)
  const time = isTyping ? "now" : formatRelative(last?.createdAt)

  return (
    <Link
      href={`/assistants/${agent.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: active ? "#EEF6F1" : "transparent",
        borderBottom: "1px solid #E5DCC8",
        textDecoration: "none",
        color: "#111",
        position: "relative",
        transition: "background 120ms",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          overflow: "hidden",
          border: "none",
          background: agent.color,
          flexShrink: 0,
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt={agent.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              fontFamily: FONT.head,
              fontSize: 14,
            }}
          >
            {agent.initials}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: FONT.head,
              fontSize: 15,
              color: "#111",
              letterSpacing: -0.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {agent.name}
          </span>
          {time && (
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: "0.3px",
                color: "#666",
                flexShrink: 0,
              }}
            >
              {time}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#666",
            marginTop: 1,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {agent.role}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dot,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT.body,
              fontSize: 13,
              color: "#333",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {isTyping ? <TypingDots /> : preview}
          </span>
          {unread && !active && (
            <span
              style={{
                flexShrink: 0,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "#1DBC87",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                display: "grid",
                placeItems: "center",
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                paddingInline: 4,
              }}
            >
              1
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function ChatList() {
  const pathname = usePathname()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const { data: statuses } = useAgentStatuses(organizationId)
  const { data: lastMap } = useLastMessages()
  const [query, setQuery] = useState("")
  const unreadSet = useUnreadTracker(lastMap, pathname)

  // Detect which agents have an in-flight sendMessage mutation.
  // useMutationState lives on the QueryClient so it survives navigation.
  const pendingMutations = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.options.mutationKey,
  })
  const typingAgentIds = new Set(
    pendingMutations
      .filter((key): key is unknown[] => Array.isArray(key) && key[0] === "sendMessage")
      .map((key) => key[1] as string)
  )

  const filtered = AGENTS.filter((a) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    )
  })

  return (
    <aside
      style={{
        background: "#FFF9ED",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #D4C9B0",
          background: "#FFF9ED",
        }}
      >
        <h2
          style={{
            fontFamily: FONT.head,
            fontSize: 20,
            margin: 0,
            fontWeight: 700,
            color: "#111",
            lineHeight: 1,
          }}
        >
          Assistants
        </h2>
        <div style={{ fontSize: 12, color: "#999", marginTop: 3 }}>
          your crew of six
        </div>
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #D4C9B0",
          background: "#FFF9ED",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#EFE7D6",
            border: "1px solid #D4C9B0",
            borderRadius: 999,
            padding: "7px 14px",
          }}
        >
          <Search className="size-4" style={{ color: "#999" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assistants"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: FONT.body,
              fontSize: 13,
              color: "#111",
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.map((agent) => {
          const active = pathname === `/assistants/${agent.id}`
          return (
            <AgentRow
              key={agent.id}
              agent={agent}
              active={active}
              status={statuses?.[agent.id]}
              last={lastMap?.[agent.id] ?? null}
              isTyping={typingAgentIds.has(agent.id)}
              unread={unreadSet.has(agent.id)}
            />
          )
        })}
      </div>
    </aside>
  )
}
