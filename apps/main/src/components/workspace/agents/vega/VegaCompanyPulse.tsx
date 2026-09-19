"use client"

import Image from "next/image"
import Link from "next/link"

import { useCompanyPulse, type AgentPulse } from "@/lib/api/workspace"
import { AGENTS, AGENT_PHOTOS, getAgent } from "@/lib/config/agents"
import type { OverviewWidgetProps } from "@/lib/workspace/types"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"

/**
 * The AI workforce, at a glance.
 *
 * Vega's acceptance criterion in the PRD is that it can summarise the whole
 * workforce without the customer opening every workspace. This is that: one
 * request, one row per employee, and a link straight to whatever is waiting.
 *
 * Vega is excluded from its own roster — it reports on the others, and listing
 * itself would be a mirror pointed at a mirror.
 */
export function VegaCompanyPulse({ agent, organizationId }: OverviewWidgetProps) {
  const { data, isLoading } = useCompanyPulse(organizationId)

  if (isLoading) {
    return <Skeleton className="h-64 rounded-[var(--vq-r)]" />
  }

  const roster = (data?.agents ?? [])
    .filter((pulse) => pulse.agent.toLowerCase() !== agent)
    .sort(
      // Loudest first: anything that needs a decision outranks anything that
      // does not, and a critical finding outranks a merely open one.
      (a, b) =>
        b.pendingApprovals + b.criticalInsights - (a.pendingApprovals + a.criticalInsights) ||
        b.openInsights - a.openInsights,
    )

  const totals = data?.totals
  const attention =
    (totals?.pendingApprovals ?? 0) + (totals?.openInsights ?? 0) + (totals?.needsReview ?? 0)

  return (
    <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-head text-sm">Your AI workforce</h2>
        <p className="text-xs text-muted-foreground">
          {attention === 0
            ? "Nothing needs you right now."
            : `${attention} ${attention === 1 ? "thing needs" : "things need"} you across ${roster.length} employees.`}
        </p>
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-(--vq-line-2)">
        {roster.map((pulse) => (
          <AgentRow key={pulse.agent} pulse={pulse} />
        ))}
      </ul>

      {(data?.handoffsInFlight ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data!.handoffsInFlight} piece
          {data!.handoffsInFlight === 1 ? "" : "s"} of work handed between employees.
        </p>
      )}
    </section>
  )
}

function AgentRow({ pulse }: { pulse: AgentPulse }) {
  const slug = pulse.agent.toLowerCase()
  const config = getAgent(slug) ?? AGENTS.find((a) => a.id === slug)
  const photo = AGENT_PHOTOS[slug]
  const needsYou = pulse.pendingApprovals + pulse.needsReview

  return (
    <li>
      <Link
        href={`/workspace/${slug}/overview`}
        className="flex items-center gap-3 py-2.5 no-underline"
      >
        <span
          className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border"
          style={{ background: config?.color }}
        >
          {photo && (
            <Image src={photo} alt={config?.name ?? slug} fill sizes="32px" className="object-cover" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {config?.name ?? pulse.agent}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {pulse.lastActivityAt
              ? `Last active ${relative(pulse.lastActivityAt)}`
              : "Nothing recorded yet"}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {needsYou > 0 && (
            <StatusPill level="warn">
              {needsYou} needs you
            </StatusPill>
          )}
          {pulse.openInsights > 0 && (
            <StatusPill level={pulse.criticalInsights > 0 ? "danger" : "info"}>
              {pulse.openInsights} found
            </StatusPill>
          )}
          {needsYou === 0 && pulse.openInsights === 0 && (
            <span className={cn("text-xs text-muted-foreground")}>Clear</span>
          )}
        </span>
      </Link>
    </li>
  )
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
