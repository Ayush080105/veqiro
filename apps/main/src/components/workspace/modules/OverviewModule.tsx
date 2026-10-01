"use client"

import { Suspense } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, Inbox, Sparkles } from "lucide-react"

import type { ModuleProps } from "@/lib/workspace/types"
import type { AgentActionId } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"
import { useWorkspaceOverview } from "@/lib/api/workspace"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useAgentWorkspace } from "../AgentWorkspaceContext"
import { useWorkspaceChat } from "../WorkspaceChatProvider"
import { InsightList } from "../panels/InsightList"
import { IncomingHandoffs } from "../panels/IncomingHandoffs"
import { ActivityFeed } from "../panels/ActivityFeed"

/**
 * The workspace landing page.
 *
 * Section order is the PRD's dashboard hierarchy and is not negotiable per
 * agent: what needs me, then what did you find, then what happens next, then
 * what did you do. The agent's own widgets come first though — for the pilot
 * that is LexHome verbatim, so the workspace opens on the thing that already
 * works rather than on a grid of empty panels.
 */
export function OverviewModule({ agent, organizationId }: ModuleProps) {
  const { spec, hrefFor } = useAgentWorkspace()
  const { openAction } = useWorkspaceChat()
  const { data, isLoading } = useWorkspaceOverview(agent, organizationId)

  return (
    <div className="flex flex-col gap-6 pb-10">
      <IncomingHandoffs handoffs={data?.incomingHandoffs} />

      {spec.overview.widgets.map((widget) => (
        <Suspense key={widget.id} fallback={<Skeleton className="h-64 rounded-[var(--vq-r)]" />}>
          <widget.Component agent={agent} organizationId={organizationId} />
        </Suspense>
      ))}

      {/* What needs me? */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<Inbox className="size-4" />}
          label="Waiting on you"
          value={isLoading ? null : (data?.pendingApprovals ?? 0)}
          href={hrefFor("approvals")}
          urgent={(data?.pendingApprovals ?? 0) > 0}
        />
        <StatTile
          icon={<AlertTriangle className="size-4" />}
          label="Open findings"
          value={isLoading ? null : (data?.insights.length ?? 0)}
          href={hrefFor("overview")}
        />
        <StatTile
          icon={<CalendarClock className="size-4" />}
          label="Automations running"
          value={isLoading ? null : (data?.automations.enabled ?? 0)}
          href={hrefFor("automations")}
          // A silently broken automation is worse than no automation, so a
          // failure is the one thing this tile shouts about.
          urgent={(data?.automations.failing ?? 0) > 0}
          note={
            data?.automations.failing
              ? `${data.automations.failing} failing`
              : undefined
          }
        />
      </section>

      {/* What did you find? */}
      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <SectionHeader
          title={`What ${spec.agent} found`}
          action={
            data?.insights.length
              ? { label: "All activity", href: hrefFor("activity") }
              : undefined
          }
        />
        <InsightList agent={agent} organizationId={organizationId} insights={data?.insights} loading={isLoading} />
      </section>

      {/* What happens next? */}
      {(data?.upcoming.length ?? 0) > 0 && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <SectionHeader title="Coming up" action={{ label: "All work", href: hrefFor("work") }} />
          <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
            {data!.upcoming.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                {item.dueAt && <DuePill dueAt={item.dueAt} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* How do I delegate? */}
      {(spec.overview.quickActions?.length ?? 0) > 0 && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <SectionHeader title="Start something" />
          <div className="mt-2 flex flex-wrap gap-2">
            {spec.overview.quickActions!.map((id) => (
              <QuickAction key={id} id={id} onRun={() => openAction(id)} />
            ))}
          </div>
        </section>
      )}

      {/* What did you do? */}
      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <SectionHeader title="Recent activity" action={{ label: "See all", href: hrefFor("activity") }} />
        <ActivityFeed events={data?.recentActivity} loading={isLoading} compact />
      </section>
    </div>
  )
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-head text-sm capitalize">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          {action.label}
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  href,
  urgent,
  note,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  href: string
  urgent?: boolean
  note?: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-[var(--vq-r)] border border-border bg-card p-4 no-underline transition-colors hover:bg-muted/50"
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      {value === null ? (
        <Skeleton className="h-7 w-10 rounded-md" />
      ) : (
        <span className="font-head text-2xl">{value}</span>
      )}
      {note && (
        <StatusPill level={urgent ? "danger" : "info"} className="mt-1 self-start">
          {note}
        </StatusPill>
      )}
    </Link>
  )
}

// Module-level so the clock read is not a call in the component body, matching
// how ActivityFeed formats its relative times.
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function DuePill({ dueAt }: { dueAt: string }) {
  const days = daysUntil(dueAt)
  const level = days < 0 ? "danger" : days <= 7 ? "warn" : "info"
  const text =
    days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`
  return (
    <StatusPill level={level} className="shrink-0">
      {text}
    </StatusPill>
  )
}

function QuickAction({ id, onRun }: { id: AgentActionId; onRun: () => void }) {
  const action = findAction(id)
  if (!action) return null
  return (
    <Button variant="outline" size="sm" onClick={onRun} className="gap-1.5">
      <Sparkles className="size-3.5" />
      {action.label}
    </Button>
  )
}
