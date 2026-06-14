"use client"

import Link from "next/link"
import { MessageSquare, Send } from "lucide-react"
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
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5 flex flex-col gap-3">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          [ activity feed ]
        </div>
        <div className="font-display text-[28px] tracking-tight text-foreground mt-0.5">
          recently
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-3.5 bg-white border-2 border-dashed border-foreground rounded-xl font-mono text-xs text-muted-foreground tracking-[0.1em]">
          {"// nothing to show yet"}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
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
              <div className="max-sm:items-start flex items-center gap-3 px-3 py-2.5 bg-white border-2 border-foreground rounded-xl transition-transform duration-[120ms] ease">
                {/* Avatar: colored base + icon behind + photo on top */}
                <div
                  className="relative size-8 rounded-full overflow-hidden border-2 border-foreground shrink-0 grid place-items-center"
                  style={{ background: bg }}
                >
                  <Icon className="size-3.5 text-foreground absolute" />
                  {agentPhoto && (
                    <img
                      src={agentPhoto}
                      alt={agent?.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = "none"
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-[13px] text-foreground line-clamp-2">
                    {item.title}
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                  {relativeTime(item.at)}
                </div>
              </div>
            )

            return item.href ? (
              <Link
                key={i}
                href={item.href}
                className="block no-underline text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
