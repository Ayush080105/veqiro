"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { TrendingUp, TrendingDown, Minus, Database } from "lucide-react"
import { getSnapshot } from "@/lib/api/rex"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import type { RexSnapshot } from "@/lib/types/agents"

function fmtCurrency(n?: number | null) {
  if (n == null) return "—"
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmtRunway(months?: number | null) {
  if (months == null) return "Profitable"
  return `${months.toFixed(1)} mo`
}

function KpiTileBtn({
  label,
  value,
  onClick,
  className,
}: {
  label: string
  value: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0 border border-border bg-background/60 px-3 py-1.5 text-center transition-colors hover:bg-muted",
        className
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold leading-tight">{value}</span>
    </button>
  )
}

export function KpiStrip({
  onOpenDataTab,
}: {
  onOpenDataTab?: () => void
}) {
  const { data: snapshot } = useQuery<RexSnapshot>({
    queryKey: ["rex", "snapshot"],
    queryFn: getSnapshot,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (!snapshot) return null

  if (!snapshot.ready) {
    return (
      <div
        className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground"
      >
        <Database className="size-3.5 shrink-0" />
        <span>Connect data to see live numbers</span>
        {onOpenDataTab && (
          <button
            type="button"
            onClick={onOpenDataTab}
            className="ml-1 underline hover:text-foreground"
          >
            Open Data tab
          </button>
        )}
      </div>
    )
  }

  const d = snapshot.data ?? {}

  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-3 py-1.5 overflow-x-auto">
      <KpiTileBtn label="MRR" value={fmtCurrency(d.mrr)} />
      <KpiTileBtn label="Cash" value={fmtCurrency(d.cash)} />
      <KpiTileBtn
        label="Runway"
        value={fmtRunway(d.runway_months)}
      />
      {d.runway_months != null && (
        <StatusPill
          level={d.runway_months > 12 ? "ok" : d.runway_months > 6 ? "warn" : "danger"}
          className="ml-1"
        >
          {d.runway_months > 12 ? "healthy" : d.runway_months > 6 ? "watch" : "critical"}
        </StatusPill>
      )}
    </div>
  )
}
