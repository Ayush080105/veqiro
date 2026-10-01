"use client"

import { Activity, Bot, Cog, User } from "lucide-react"

import type { ActivityEvent } from "@/lib/api/workspace"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const ACTOR_ICON = {
  USER: User,
  AGENT: Bot,
  SYSTEM: Cog,
} as const

/** Coarse relative time — this is a log, not a stopwatch. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Human-readable activity, not a debug log.
 *
 * The summary is rendered from the stored string rather than reconstructed
 * from the verb and object: it was written at event time precisely so it keeps
 * describing what happened even after the contract gets renamed.
 */
export function ActivityFeed({
  events,
  loading,
  compact,
}: {
  events?: ActivityEvent[]
  loading?: boolean
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-9 rounded-[var(--vq-r-sm)]" />
        <Skeleton className="h-9 rounded-[var(--vq-r-sm)]" />
        <Skeleton className="h-9 rounded-[var(--vq-r-sm)]" />
      </div>
    )
  }

  if (!events || events.length === 0) {
    // On the overview this is one panel among several, so it gets a line.
    // On the Activity module it is the whole page, and an empty page deserves
    // to say so properly.
    return compact ? (
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="size-3.5 shrink-0" />
        Nothing yet. Reviews, drafts and scheduled runs will be recorded here.
      </p>
    ) : (
      <EmptyState
        tone="plain"
        icon={<Activity />}
        title="Nothing yet"
        description="Reviews, drafts, approvals and scheduled runs will be recorded here."
      />
    )
  }

  const shown = compact ? events.slice(0, 8) : events

  return (
    <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
      {shown.map((event) => {
        const Icon = ACTOR_ICON[event.actorKind] ?? Cog
        return (
          <li key={event.id} className={cn("flex items-center gap-3", compact ? "py-2" : "py-2.5")}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{event.summary}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime(event.createdAt)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
