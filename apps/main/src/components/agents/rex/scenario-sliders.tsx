"use client"

import * as React from "react"
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
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-medium">
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
        className="h-1.5 w-full accent-primary"
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
    <div className="border border-border overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide">Scenario</th>
            <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Runway</th>
            <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">vs Base</th>
            <th className="px-2 py-1 text-right font-mono text-[10px] uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody>
          {result.base_case && (
            <tr className="border-b border-border bg-muted/10">
              <td className="px-2 py-1 text-muted-foreground">Base</td>
              <td className="px-2 py-1 text-right">
                {result.base_case.runway_months != null
                  ? `${(result.base_case.runway_months as number).toFixed(1)} mo`
                  : "Profitable"}
              </td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">
                <StatusPill level={verdictLevel(result.base_case.verdict as string)}>
                  {result.base_case.verdict as string}
                </StatusPill>
              </td>
            </tr>
          )}
          {scenarios.map((s, i) => {
            const delta = s.vs_base?.runway_delta
            return (
              <tr key={i} className={cn("border-b border-border last:border-0", i === editingIdx && "bg-primary/5")}>
                <td className="px-2 py-1">
                  {s.name}
                  {i === editingIdx && <span className="ml-1 text-[9px] text-muted-foreground">(live)</span>}
                </td>
                <td className="px-2 py-1 text-right">
                  {s.runway_months != null ? `${(s.runway_months as number).toFixed(1)} mo` : "Profitable"}
                </td>
                <td className="px-2 py-1 text-right">
                  {delta != null ? (
                    <span className={cn(delta > 0 ? "text-chart-2" : "text-destructive")}>
                      {delta > 0 ? "+" : ""}{delta}mo
                    </span>
                  ) : "—"}
                </td>
                <td className="px-2 py-1 text-right">
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
                "border border-border px-2 py-0.5 text-[10px]",
                editingIdx === i ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border border-border bg-muted/10 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
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
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <RefreshCw className="size-2.5 animate-spin" /> Recalculating…
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

      <p className="text-[11px] leading-relaxed">{result.recommendation}</p>

    </div>
  )
}
