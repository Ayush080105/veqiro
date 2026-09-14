"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { AGENTS, getAgentBySlug } from "@/lib/config/agents"
import type { DashboardSummary, Range } from "@/lib/api/dashboard"

function TinySparkline({ values }: { values: number[] }) {
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
        stroke="var(--muted-foreground)"
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

function rangeLabel(range: Range): string {
  switch (range.kind) {
    case "24h":    return "Busiest today"
    case "7d":     return "Busiest this week"
    case "30d":    return "Busiest this month"
    case "custom": return "Busiest in range"
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

  return (
    <div className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-3.5">
        <div className="font-head text-2xl text-foreground">{rangeLabel(range)}</div>
        <p className="m-0 mt-1 text-xs text-muted-foreground">Agent activity by selected range.</p>
      </div>

      {!hasAny && (
        <div className="mb-3 rounded-[var(--vq-r-sm)] border border-dashed border-border bg-muted/40 px-4 py-3.5 text-xs text-muted-foreground">
          No agent activity yet. Start a chat.
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {sorted.map((row, i) => {
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
              className="vq-stagger-item grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--vq-r-sm)] border border-border bg-card p-3 text-foreground no-underline transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[44px_120px_minmax(80px,1fr)_auto_80px]"
              style={{ "--vq-stagger-i": i } as CSSProperties}
            >
              <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                <span
                  className="absolute inset-0 grid select-none place-items-center text-[10px] font-bold text-muted-foreground"
                  aria-hidden
                >
                  {agent.initials}
                </span>
                <img
                  src={agentPhoto}
                  alt={agent.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>

              <div className="min-w-0">
                <div className="truncate font-head text-[14px] tracking-tight">
                  {agent.name}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {relativeTime(row.lastActivity)}
                </div>
              </div>

              <div className="relative col-span-2 h-2.5 overflow-hidden rounded-full border border-border bg-muted sm:col-span-1">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: `scaleX(${pct / 100})`,
                    transformOrigin: "left",
                    background: "var(--foreground)",
                    transition: "transform 300ms ease",
                  }}
                />
              </div>

              <div className="col-start-3 row-start-1 min-w-8 text-right font-head text-base text-foreground sm:col-auto sm:row-auto">
                {row.messagesWeek}
              </div>

              <div className="hidden sm:block">
                <TinySparkline values={row.sparkline} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
