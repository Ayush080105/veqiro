"use client"

import { useOutcomes } from "@/lib/api/workspace"
import type { OverviewWidgetProps } from "@/lib/workspace/types"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Did the workforce actually accomplish anything?
 *
 * The PRD is blunt about this: measure completed business work, not chat
 * volume. These are its success criteria, and every one comes from the
 * framework tables rather than from counting messages.
 *
 * Rates render as "—" when there is no denominator yet. A new org does not
 * have a 0% action rate; it has no action rate, and showing zero would read as
 * a failing grade for having just signed up.
 */
export function VegaOutcomes({ organizationId }: OverviewWidgetProps) {
  const { data, isLoading } = useOutcomes(organizationId)

  if (isLoading) return <Skeleton className="h-28 rounded-[var(--vq-r)]" />
  if (!data) return null

  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: "Work completed",
      value: String(data.workCompleted),
      hint: `in ${data.periodDays} days`,
    },
    {
      label: "Findings surfaced",
      value: String(data.insightsSurfaced),
      hint: "without being asked",
    },
    {
      label: "Acted on",
      value: percent(data.actionRate),
      hint: "of findings you decided",
    },
    {
      label: "Ran on its own",
      value: percent(data.proactiveShare),
      hint: "of agent work",
    },
    {
      label: "Approvals",
      value:
        data.approvalMedianMinutes === null
          ? "—"
          : `${formatMinutes(data.approvalMedianMinutes)}`,
      hint: "typical time to decide",
    },
    {
      label: "Handed over",
      value: String(data.handoffsCreated),
      hint: `${data.handoffsCompleted} finished`,
    },
  ]

  return (
    <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
      <h2 className="font-head text-sm">What got done</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dd className="font-head text-xl leading-tight">{stat.value}</dd>
            <dt className="mt-0.5 text-xs text-muted-foreground">{stat.label}</dt>
            {stat.hint && (
              <p className="text-[11px] text-muted-foreground/70">{stat.hint}</p>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
