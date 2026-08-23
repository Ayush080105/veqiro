"use client"

import { useValueReport } from "@/lib/api/mcp"

/**
 * The renewal artifact: what the agents actually did across the customer's own
 * systems this period.
 *
 * Every figure here comes from the MCP action log — real recorded provider
 * calls, not estimates — because this is the number a customer will check
 * against their own systems, and one inflated claim discredits the rest.
 */

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
    <div className="flex flex-col gap-1 rounded-lg border-2 border-foreground bg-background px-3.5 py-3">
      <div className="font-display text-[30px] leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {hint && <div className="text-[11px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function ValueReportCard() {
  const { data, isLoading } = useValueReport()

  const hasData = Boolean(data && data.actions > 0)

  return (
    <div className="rounded-2xl border-[3px] border-foreground bg-card p-5 shadow-[6px_6px_0_var(--foreground)]">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ last {data?.periodDays ?? 30} days ]
      </div>
      <div className="mt-0.5 mb-4 font-display text-[26px] tracking-tight text-foreground">
        what veqiro did
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[84px] animate-pulse rounded-lg border-2 border-foreground/15 bg-muted/40"
            />
          ))}
        </div>
      ) : !hasData ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          Nothing recorded yet. Once your agents start working across connected systems, this
          becomes a running record of exactly what they did.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat value={data!.actions.toLocaleString("en-US")} label="actions taken" />
            <Stat value={data!.systemsTouched.toLocaleString("en-US")} label="systems touched" />
            <Stat
              value={data!.writes.toLocaleString("en-US")}
              label="changes made"
              hint="each one you approved"
            />
            <Stat
              value={data!.hoursSaved === null ? "—" : `${data!.hoursSaved}h`}
              label="hours saved"
              hint={data!.hoursSaved === null ? "still measuring" : "conservative estimate"}
            />
          </div>

          {data!.breakdown.length > 0 && (
            <div className="mt-4 border-t-2 border-foreground/10 pt-3.5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                busiest systems
              </div>
              <div className="flex flex-col gap-1.5">
                {data!.breakdown.slice(0, 5).map((row) => {
                  const share = Math.round((row.actions / data!.actions) * 100)
                  return (
                    <div key={row.slug} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 truncate text-xs text-foreground">{row.name}</div>
                      <div
                        className="h-2.5 flex-1 overflow-hidden rounded-full border border-foreground/20 bg-muted"
                        role="img"
                        aria-label={`${row.name}: ${share}% of actions`}
                      >
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                      <div className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
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
    </div>
  )
}
