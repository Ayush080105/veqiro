"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { AGENTS } from "@/lib/config/agents"
import { useAgentStatuses, useLastMessages } from "@/lib/api/assistants"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"
import { FONT } from "@/components/veqiro/shared"
import type {
  AgentStatusData,
  AgentConfig,
  LastMessage,
} from "@/lib/types"

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
    return `${prefix}${last.content}`.replace(/\s+/g, " ").trim()
  }
  return fallback ?? "No messages yet"
}

function AgentRow({
  agent,
  active,
  status,
  last,
}: {
  agent: AgentConfig
  active: boolean
  status: AgentStatusData | undefined
  last: LastMessage | null
}) {
  const Portrait = CHARACTER_COMPONENTS[agent.id]
  const dot = STATUS_DOT[status?.status ?? "idle"]
  const preview = previewLine(last, status?.lastActivity)
  const time = formatRelative(last?.createdAt)

  return (
    <Link
      href={`/assistants/${agent.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: active ? "#FFF9ED" : "transparent",
        borderTop: "2px solid #111",
        textDecoration: "none",
        color: "#111",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid #111",
          background: agent.color,
          flexShrink: 0,
          boxShadow: active ? "3px 3px 0 #111" : "2px 2px 0 #111",
          transform: active ? "translate(-1px,-1px)" : "none",
        }}
      >
        {Portrait ? (
          <Portrait size={48} />
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
                letterSpacing: 1,
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
            letterSpacing: 1.5,
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
            {preview}
          </span>
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
        width: 340,
        flexShrink: 0,
        borderRight: "3px solid #111",
        background: "#EFE7D6",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "18px 16px 12px",
          borderBottom: "2px solid #111",
          background: "#F5C518",
        }}
      >
        <h2
          style={{
            fontFamily: FONT.display,
            fontSize: 28,
            margin: 0,
            letterSpacing: -1,
            color: "#111",
            lineHeight: 1,
          }}
        >
          assistants
        </h2>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#111",
            opacity: 0.7,
            marginTop: 4,
          }}
        >
          your crew of six
        </div>
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderBottom: "2px solid #111",
          background: "#FFF9ED",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: "2px solid #111",
            borderRadius: 999,
            padding: "8px 14px",
            boxShadow: "2px 2px 0 #111",
          }}
        >
          <Search className="size-4" style={{ color: "#666" }} />
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
            />
          )
        })}
      </div>
    </aside>
  )
}
