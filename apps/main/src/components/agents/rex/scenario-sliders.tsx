"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { scenario as runScenario } from "@/lib/api/rex"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import type { RexScenarioResult, RexScenarioResultItem } from "@/lib/types/agents"

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}

function LabeledSlider({ label, value, min, max, step, unit = "", onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">
          {value > 0 ? "+" : ""}{value.toLocaleString()}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
    </div>
  )
}

interface LiveScenarioTableProps {
  result: RexScenarioResult
  editingIdx: number
  burnDelta: number
  mrrDelta: number
  growthOverride: number | null
}

function verdictLevel(v: string) {
  return v === "green" ? "ok" : v === "amber" ? "warn" : "danger"
}

function LiveScenarioTable({ result, editingIdx, burnDelta, mrrDelta, growthOverride }: LiveScenarioTableProps) {
  const scenarios = result.scenarios.map((s, i) => {
    if (i !== editingIdx) return s
    const delta = s.vs_base?.runway_delta ?? null
    return {
      ...s,
      name: s.name,
      _live: true,
    } as RexScenarioResultItem & { _live?: boolean }
  })

  return (
    <div className="overflow-hidden rounded-[var(--vq-r-sm)] border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-background/65">
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Scenario</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Runway</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">vs Base</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {result.base_case && (
            <tr className="border-b border-border/60 bg-muted/10">
              <td className="px-3 py-2 text-muted-foreground">Base</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {result.base_case.runway_months != null
                  ? `${(result.base_case.runway_months as number).toFixed(1)} mo`
                  : "Profitable"}
              </td>
              <td className="px-3 py-2 text-right">—</td>
              <td className="px-3 py-2 text-right">
                <StatusPill level={verdictLevel(result.base_case.verdict as string)}>
                  {result.base_case.verdict as string}
                </StatusPill>
              </td>
            </tr>
          )}
          {scenarios.map((s, i) => {
            const delta = s.vs_base?.runway_delta
            return (
              <tr key={i} className={cn("border-b border-border/60 last:border-0", i === editingIdx && "bg-primary/5")}>
                <td className="px-3 py-2">
                  {s.name}
                  {i === editingIdx && <span className="ml-1 text-xs text-muted-foreground">(live)</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.runway_months != null ? `${(s.runway_months as number).toFixed(1)} mo` : "Profitable"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {delta != null ? (
                    <span className={cn(delta > 0 ? "text-chart-2" : "text-destructive")}>
                      {delta > 0 ? "+" : ""}{delta}mo
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <StatusPill level={verdictLevel(s.verdict as string)}>{s.verdict as string}</StatusPill>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ScenarioSliders({
  initialResult,
  baseMetrics,
}: {
  initialResult: RexScenarioResult
  baseMetrics: { mrr: number; burn: number; cash: number; growth_rate: number }
}) {
  const [result, setResult] = React.useState(initialResult)
  const [editingIdx, setEditingIdx] = React.useState(0)
  const [burnDelta, setBurnDelta] = React.useState(0)
  const [mrrDelta, setMrrDelta] = React.useState(0)
  const [growthPct, setGrowthPct] = React.useState(
    Math.round((baseMetrics.growth_rate ?? 0) * 100)
  )
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const recomputeMut = useMutation({
    mutationFn: () =>
      runScenario({
        base_metrics: baseMetrics,
        scenarios: initialResult.scenarios.map((s, i) =>
          i === editingIdx
            ? {
                name: s.name,
                changes: {
                  burn_delta: burnDelta,
                  mrr_delta: mrrDelta,
                  growth_rate_override: growthPct / 100,
                },
              }
            : { name: s.name, changes: (s as RexScenarioResultItem & { changes?: object }).changes ?? {} }
        ),
      }),
    onSuccess: (data) => setResult(data),
  })

  const triggerRecompute = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => recomputeMut.mutate(), 350)
  }, [recomputeMut])

  const handleBurnDelta = (v: number) => { setBurnDelta(v); triggerRecompute() }
  const handleMrrDelta = (v: number) => { setMrrDelta(v); triggerRecompute() }
  const handleGrowthPct = (v: number) => { setGrowthPct(v); triggerRecompute() }

  if (initialResult.scenarios.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {initialResult.scenarios.length > 1 && (
        <div className="flex gap-1.5">
          {initialResult.scenarios.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setEditingIdx(i)}
              className={cn(
                "rounded-[var(--vq-r-sm)] border border-border px-2.5 py-1 text-xs font-medium transition-colors",
                editingIdx === i ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65 p-3">
        <p className="text-xs font-semibold text-foreground">
          Adjust: {initialResult.scenarios[editingIdx]?.name}
        </p>
        <LabeledSlider
          label="Burn delta"
          value={burnDelta}
          min={-50000}
          max={100000}
          step={1000}
          unit="$"
          onChange={handleBurnDelta}
        />
        <LabeledSlider
          label="MRR delta"
          value={mrrDelta}
          min={-20000}
          max={50000}
          step={500}
          unit="$"
          onChange={handleMrrDelta}
        />
        <LabeledSlider
          label="Growth rate"
          value={growthPct}
          min={-20}
          max={50}
          step={1}
          unit="%"
          onChange={handleGrowthPct}
        />
        {recomputeMut.isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" /> Recalculating...
          </div>
        )}
      </div>

      <LiveScenarioTable
        result={result}
        editingIdx={editingIdx}
        burnDelta={burnDelta}
        mrrDelta={mrrDelta}
        growthOverride={growthPct / 100}
      />

      <p className="text-sm leading-relaxed">{result.recommendation}</p>

    </div>
  )
}
