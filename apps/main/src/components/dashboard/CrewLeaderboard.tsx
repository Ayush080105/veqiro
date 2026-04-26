"use client"

import Link from "next/link"
import { AGENTS, getAgentBySlug } from "@/lib/config/agents"
import { CHARACTER_COMPONENTS } from "@/components/veqiro/characters"
import { FONT } from "@/lib/fonts"
import type { DashboardSummary } from "@/lib/api/dashboard"

function TinySparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null
  const w = 80
  const h = 24
  const max = Math.max(1, ...values)
  const stepX = values.length > 1 ? w / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = i * stepX
      const y = h - (v / max) * h
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" L ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
      <path d={`M ${points}`} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  )
}

function relativeTime(iso: string | null): string {
  if (!iso) return "no activity"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export function CrewLeaderboard({
  data,
}: {
  data: DashboardSummary["leaderboard"]
}) {
  const sorted = [...data].sort((a, b) => b.messagesWeek - a.messagesWeek)
  const max = Math.max(1, ...sorted.map((r) => r.messagesWeek))
  const hasAny = sorted.some((r) => r.messagesWeek > 0)

  return (
    <div
      style={{
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 16,
        boxShadow: "6px 6px 0 #111",
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#555",
        }}
      >
        [ leaderboard · 7d ]
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 28,
          letterSpacing: -0.5,
          color: "#111",
          marginTop: 2,
          marginBottom: 14,
        }}
      >
        busiest this week
      </div>

      {!hasAny && (
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
            marginBottom: 12,
          }}
        >
          {"// nobody's clocked in yet — start a chat"}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((row) => {
          const agent = (() => {
            try {
              return getAgentBySlug(row.slug)
            } catch {
              return AGENTS[0]
            }
          })()
          const Portrait = CHARACTER_COMPONENTS[agent.id]
          const pct = (row.messagesWeek / max) * 100
          return (
            <Link
              key={row.slug}
              href={`/assistants/${row.slug}`}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 120px 1fr auto auto",
                alignItems: "center",
                gap: 14,
                padding: "10px 12px",
                background: "#fff",
                border: "2.5px solid #111",
                borderRadius: 12,
                textDecoration: "none",
                color: "#111",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2.5px solid #111",
                  background: agent.color,
                }}
              >
                {Portrait ? (
                  <Portrait size={40} />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: FONT.head,
                      fontSize: 12,
                    }}
                  >
                    {agent.initials}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT.head,
                    fontSize: 14,
                    letterSpacing: -0.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {relativeTime(row.lastActivity)}
                </div>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 18,
                  background: "#EFE7D6",
                  border: "2px solid #111",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: agent.color,
                    transition: "width 300ms ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: FONT.head,
                  fontSize: 16,
                  color: "#111",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {row.messagesWeek}
              </div>
              <TinySparkline values={row.sparkline} color={agent.color} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
