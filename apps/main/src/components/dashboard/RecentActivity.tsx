"use client"

import Link from "next/link"
import { MessageSquare, Send } from "lucide-react"
import { FONT } from "@/lib/fonts"
import { AGENTS, getAgentBySlug } from "@/lib/config/agents"
import type { DashboardSummary } from "@/lib/api/dashboard"

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function RecentActivity({ items }: { items: DashboardSummary["recentActivity"] }) {
  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#555",
          }}
        >
          [ activity feed ]
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 28,
            letterSpacing: -0.5,
            color: "#111",
            marginTop: 2,
          }}
        >
          recently
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            background: "#fff",
            border: "2px dashed #111",
            borderRadius: 10,
            fontFamily: FONT.mono,
            fontSize: 12,
            color: "#555",
            letterSpacing: 1,
          }}
        >
          {"// nothing to show yet"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, i) => {
            const agent = item.agent
              ? (() => {
                  try {
                    return getAgentBySlug(item.agent)
                  } catch {
                    return AGENTS[0]
                  }
                })()
              : null
            const agentPhoto = agent ? `/agents/${agent.id}.jpeg` : null
            const bg = agent?.color ?? "#F5C518"
            const Icon = item.type === "post" ? Send : MessageSquare

            const content = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 10,
                  transition: "transform 120ms ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: "2px solid #111",
                    background: bg,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {agentPhoto ? (
                    <img src={agentPhoto} alt={agent?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Icon className="size-3.5" style={{ color: "#111" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 13,
                      color: "#111",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#666",
                    flexShrink: 0,
                  }}
                >
                  {relativeTime(item.at)}
                </div>
              </div>
            )
            return item.href ? (
              <Link
                key={i}
                href={item.href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {content}
              </Link>
            ) : (
              <div key={i}>{content}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
