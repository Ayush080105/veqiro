"use client"

import { getIntegrationBySlug } from "@repo/integrations-catalog"
import { Workflow } from "lucide-react"

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { IntegrationLogo } from "@/components/integrations/IntegrationCatalogCard"
import { useValueReport } from "@/lib/api/mcp"

function Stat({
  value,
  label,
  hint,
}: {
  value: string
  label: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--vq-r-sm)] border border-border bg-background/45 px-3.5 py-3">
      <div className="font-head text-3xl leading-none tabular-nums text-foreground">{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function ValueReportCard() {
  const { data, isLoading } = useValueReport()
  const hasData = Boolean(data && data.actions > 0)
  const periodDays = data?.periodDays ?? 30

  return (
    <section className="rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <div className="mb-4">
        <h2 className="m-0 font-head text-2xl text-foreground">Value breakdown</h2>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          What Veqiro did across connected systems in the last {periodDays} days.
        </p>
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[var(--vq-r-sm)] border border-border bg-muted/40" />
          ))}
        </div>
      ) : !hasData ? (
        <DashboardEmptyState
          icon={Workflow}
          title="No system actions recorded"
          description="Connect tools and approve agent actions; this becomes the proof of work Veqiro completed."
          action={{ label: "Connect tools", href: "/settings/integrations" }}
          framed={false}
          className="w-full"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat value={data!.actions.toLocaleString("en-US")} label="actions taken" />
            <Stat value={data!.systemsTouched.toLocaleString("en-US")} label="systems touched" />
            <Stat value={data!.writes.toLocaleString("en-US")} label="changes made" hint="each one you approved" />
            <Stat
              value={data!.hoursSaved === null ? "-" : `${data!.hoursSaved}h`}
              label="hours saved"
              hint={data!.hoursSaved === null ? "still measuring" : "conservative estimate"}
            />
          </div>

          {data!.breakdown.length > 0 && (
            <div className="mt-4 border-t border-border pt-3.5">
              <div className="mb-2 text-sm font-semibold text-foreground">Busiest systems</div>
              <div className="grid gap-2">
                {data!.breakdown.slice(0, 5).map((row) => {
                  const share = Math.round((row.actions / data!.actions) * 100)
                  const integration = getIntegrationBySlug(row.slug)
                  return (
                    <div
                      key={row.slug}
                      className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--vq-r-sm)] border border-border bg-background/45 px-2.5 py-2"
                    >
                      <IntegrationLogo name={row.name} logoUrl={integration?.logoUrl} />
                      <div className="min-w-0" role="img" aria-label={`${row.name}: ${share}% of actions`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-foreground">{row.name}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{share}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(share, 2)}%` }} />
                        </div>
                      </div>
                      <div className="w-12 shrink-0 text-right font-head text-sm tabular-nums text-foreground">
                        {row.actions.toLocaleString("en-US")}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
