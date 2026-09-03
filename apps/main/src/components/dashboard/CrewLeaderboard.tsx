"use client"

import Link from "next/link"
import { AGENTS, getAgentBySlug } from "@/lib/config/agents"
import type { DashboardSummary, Range } from "@/lib/api/dashboard"

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
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
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

function rangeLabel(range: Range): { kicker: string; title: string } {
  switch (range.kind) {
    case "24h":    return { kicker: "leaderboard - 24h",    title: "busiest today" }
    case "7d":     return { kicker: "leaderboard - 7d",     title: "busiest this week" }
    case "30d":    return { kicker: "leaderboard - 30d",    title: "busiest this month" }
    case "custom": return { kicker: "leaderboard - custom", title: "busiest in range" }
  }
}

export function CrewLeaderboard({
  data,
  range = { kind: "7d" },
}: {
  data: DashboardSummary["leaderboard"]
  range?: Range
}) {
  const sorted = [...data].sort((a, b) => b.messagesWeek - a.messagesWeek)
  const max = Math.max(1, ...sorted.map((r) => r.messagesWeek))
  const hasAny = sorted.some((r) => r.messagesWeek > 0)
  const { kicker, title } = rangeLabel(range)

  return (
    <div className="bg-card border border-[var(--vq-line-2)] rounded-2xl shadow-[var(--vq-shadow)] p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ {kicker} ]
      </div>
      <div className="font-display text-[28px] tracking-tight text-foreground mt-0.5 mb-3.5">
        {title}
      </div>

      {!hasAny && (
        <div className="px-4 py-3.5 bg-white border border-dashed border-[var(--vq-line-2)] rounded-xl font-mono text-xs text-muted-foreground tracking-[0.1em] mb-3">
          {"// nobody's clocked in yet - start a chat"}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {sorted.map((row) => {
          const agent = (() => {
            try {
              return getAgentBySlug(row.slug)
            } catch {
              return AGENTS[0]
            }
          })()
          const agentPhoto = `/agents/${agent.id}.jpeg`
          const pct = (row.messagesWeek / max) * 100
          return (
            <Link
              key={row.slug}
              href={`/assistants/${row.slug}`}
              className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 p-3 no-underline bg-white border border-[var(--vq-line-2)] rounded-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[44px_120px_minmax(80px,1fr)_auto_80px]"
            >
              {/* Avatar: colored base + initials behind + photo on top */}
              <div
                className="relative size-10 rounded-full overflow-hidden border border-[var(--vq-line-2)] shrink-0"
                style={{ background: agent.color }}
              >
                <span
                  className="absolute inset-0 grid place-items-center font-mono text-[10px] font-bold text-white select-none"
                  aria-hidden
                >
                  {agent.initials}
                </span>
                <img
                  src={agentPhoto}
                  alt={agent.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>

              <div className="min-w-0">
                <div className="font-head text-[14px] tracking-tight truncate">
                  {agent.name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground truncate">
                  {relativeTime(row.lastActivity)}
                </div>
              </div>

              <div
                className="col-span-2 sm:col-span-1 relative h-[18px] bg-background border border-[var(--vq-line-2)] rounded-full overflow-hidden"
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

              <div className="col-start-3 row-start-1 sm:col-auto sm:row-auto font-head text-base text-foreground min-w-8 text-right">
                {row.messagesWeek}
              </div>

              <div className="hidden sm:block">
                <TinySparkline values={row.sparkline} color={agent.color} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
