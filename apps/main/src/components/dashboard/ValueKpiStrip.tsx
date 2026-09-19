"use client"

import Link from "next/link"
import { Clock3, Inbox, Send, Workflow } from "lucide-react"

import type { DashboardSummary } from "@/lib/api/dashboard"
import { useCommandCenter, useValueReport } from "@/lib/api/mcp"
import { cn } from "@/lib/utils"

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString("en-US")
}

function publishedDelta(current: number, previous: number): string {
  const diff = current - previous
  if (diff === 0) return "stable vs previous window"
  return `${diff > 0 ? "+" : ""}${diff} vs previous window`
}

function KpiCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  urgent = false,
}: {
  label: string
  value: string
  detail: string
  href?: string
  icon: typeof Clock3
  urgent?: boolean
}) {
  const body = (
    <div
      className={cn(
        "flex min-h-28 flex-col justify-between rounded-[var(--vq-r)] border border-border bg-card p-3 shadow-[var(--vq-shadow-sm)] sm:min-h-36 sm:p-4",
        href && "transition-colors hover:bg-muted/35",
        urgent && "border-destructive/45 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</div>
        <Icon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
      </div>
      <div>
        <div className="font-head text-3xl leading-none tabular-nums text-foreground sm:text-4xl">{value}</div>
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs">{detail}</div>
      </div>
    </div>
  )

  return href ? <Link href={href}>{body}</Link> : body
}

export function ValueKpiStrip({
  metrics,
  pipeline,
  loading,
}: {
  metrics?: DashboardSummary["metrics"]
  pipeline: DashboardSummary["contentPipeline"]
  loading: boolean
}) {
  const command = useCommandCenter()
  const valueReport = useValueReport()
  const pending = command.data?.pendingActionCount ?? 0
  const recent = command.data?.recentActionCount ?? 0
  const actions = valueReport.data?.actions ?? 0
  const writes = valueReport.data?.writes ?? 0
  const periodDays = valueReport.data?.periodDays ?? 30
  const scheduled = pipeline.byStatus.scheduled
  const drafts = pipeline.byStatus.draft

  if (loading || command.isLoading || valueReport.isLoading) {
    return (
      <section className="grid grid-cols-2 gap-3.5 lg:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]" data-tour="dashboard-metrics">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[var(--vq-r)] border border-border bg-card shadow-[var(--vq-shadow-sm)] sm:h-36" />
        ))}
      </section>
    )
  }

  return (
    <section className="grid grid-cols-2 gap-3.5 lg:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]" data-tour="dashboard-metrics">
      <KpiCard
        label="Time saved"
        value={metrics ? `${metrics.hoursSavedEstimate}h` : "-"}
        detail="Estimated manual work avoided in this window."
        icon={Clock3}
      />
      <KpiCard
        label="Actions automated"
        value={formatNumber(actions)}
        detail={`${formatNumber(writes)} approved ${writes === 1 ? "change" : "changes"} in the last ${periodDays} days.`}
        href="/settings/usage"
        icon={Workflow}
      />
      <KpiCard
        label="Work shipped"
        value={metrics ? formatNumber(metrics.contentPublishedWeek) : "-"}
        detail={`${scheduled} scheduled, ${drafts} in draft. ${metrics ? publishedDelta(metrics.contentPublishedWeek, metrics.contentPublishedPrevWeek) : ""}`}
        href="/assistants/maya"
        icon={Send}
      />
      <KpiCard
        label="Needs you"
        value={formatNumber(pending)}
        detail={pending > 0 ? "Approvals are waiting before agents can proceed." : `${recent} actions ran in the last 24 hours.`}
        href={pending > 0 ? "/assistants" : "/settings/integrations"}
        icon={Inbox}
        urgent={pending > 0}
      />
    </section>
  )
}
