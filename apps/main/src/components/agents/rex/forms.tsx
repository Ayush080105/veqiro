"use client"

import * as React from "react"
import { Plus, X, Database, ChevronDown, Send, Sparkles, Loader2, FileDown } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Controller } from "react-hook-form"

import { listDatasets, queryDataset, analyzeDataset, generateDatasetReport } from "@/lib/api/rex"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { DataPointTable, CountedTextarea } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { cn } from "@/lib/utils"
import type { DataPoint, RexDatasetRecord, RexQueryDatasetResult, RexAnalyzeDatasetResult } from "@/lib/types/agents"
import {
  rexAnalyzeMetricsSchema,
  type RexAnalyzeMetricsValues,
  rexForecastSchema,
  type RexForecastValues,
  rexFinancialAnalysisSchema,
  type RexFinancialAnalysisValues,
  rexBriefingSchema,
  type RexBriefingValues,
  rexRunwaySchema,
  type RexRunwayValues,
  rexUnitEconomicsSchema,
  type RexUnitEconomicsValues,
  rexScenarioSchema,
  type RexScenarioValues,
  rexWeeklyDigestSchema,
  type RexWeeklyDigestValues,
  rexInvestorUpdateSchema,
  type RexInvestorUpdateValues,
  rexVarianceSchema,
  type RexVarianceValues,
  rexBoardDeckSchema,
  type RexBoardDeckValues,
  REX_PERIODS,
  rexQueryDatasetSchema,
  type RexQueryDatasetValues,
  rexAnalyzeDatasetSchema,
  type RexAnalyzeDatasetValues,
} from "@/lib/schemas/agents/rex"
// ─── Dataset picker ──────────────────────────────────────────────────────────

const REX_DATASETS_QK = ["rex", "datasets", "picker"]

function DatasetPicker({
  metricHints = [],
  onSelect,
  label = "Load from dataset",
}: {
  metricHints?: string[]
  onSelect: (points: DataPoint[], dataset: RexDatasetRecord) => void
  label?: string
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  const filtered =
    metricHints.length > 0
      ? datasets.filter((d) => metricHints.includes(d.metricKey))
      : datasets

  if (filtered.length === 0) {
    return (
      <p className="text-[10px] italic text-muted-foreground">
        No datasets yet — upload data in the Data tab to load from here.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Database className="size-3 shrink-0 text-muted-foreground" />
      <div className="relative flex-1">
        <select
          defaultValue=""
          onChange={(e) => {
            const ds = filtered.find((d) => d.id === e.target.value)
            if (ds) onSelect(ds.points as DataPoint[], ds)
            e.target.value = ""
          }}
          className={cn(
            "w-full appearance-none border border-dashed border-border bg-muted/20 px-2 py-1 pr-6",
            "text-[10px] font-mono text-muted-foreground hover:bg-muted cursor-pointer",
          )}
        >
          <option value="" disabled>{label} →</option>
          {filtered.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.points.length} pts · {d.period})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

type MetricEntry = { name: string; data: DataPoint[] }

function metricsMapToEntries(
  map: Record<string, DataPoint[]>
): MetricEntry[] {
  return Object.entries(map).map(([name, data]) => ({ name, data }))
}

function entriesToMetricsMap(
  entries: MetricEntry[]
): Record<string, DataPoint[]> {
  return Object.fromEntries(
    entries.filter((e) => e.name.trim()).map((e) => [e.name, e.data])
  )
}

// ─── Analyze metrics ────────────────────────────────────────────────────────

// Maintains local entry state so empty-named rows persist after "Add metric"
// (entriesToMetricsMap filters empty names, which made new rows disappear).
function MetricsEditor({
  value,
  onChange,
}: {
  value: Record<string, DataPoint[]>
  onChange: (v: Record<string, DataPoint[]>) => void
}) {
  const [entries, setEntries] = React.useState<MetricEntry[]>(() =>
    metricsMapToEntries(value ?? {})
  )

  // Sync when the parent value changes externally (prefill / form reset)
  const prevValueRef = React.useRef(value)
  React.useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      setEntries(metricsMapToEntries(value ?? {}))
    }
  }, [value])

  // Commits both local state and RHF map
  const commit = (next: MetricEntry[]) => {
    setEntries(next)
    onChange(entriesToMetricsMap(next))
  }

  return (
    <div className="flex flex-col gap-2">
      <DatasetPicker
        onSelect={(_, ds) =>
          commit([...entries, { name: ds.metricKey, data: ds.points as DataPoint[] }])
        }
        label="Add metric from saved dataset"
      />
      {entries.map((entry, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 border border-border bg-muted/20 p-2"
        >
          <div className="flex gap-1.5">
            <Input
              value={entry.name}
              placeholder="e.g. mrr, signups, dau"
              onChange={(e) =>
                commit(entries.map((x, j) => j === i ? { ...x, name: e.target.value } : x))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove metric"
              onClick={() => commit(entries.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </div>
          <DataPointTable
            value={entry.data}
            onChange={(data) =>
              commit(entries.map((x, j) => (j === i ? { ...x, data } : x)))
            }
          />
        </div>
      ))}
      {/* "Add metric" only updates local state so the empty row is not filtered away */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEntries((prev) => [...prev, { name: "", data: [] }])}
        className="self-start"
      >
        <Plus data-icon="inline-start" /> Add metric
      </Button>
    </div>
  )
}

export function RexAnalyzeMetricsForm({
  value,
  onChange,
}: {
  value: RexAnalyzeMetricsValues
  onChange: (patch: Partial<RexAnalyzeMetricsValues>) => void
}) {
  const form = useAgentForm({
    schema: rexAnalyzeMetricsSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="metrics"
        label="Metrics"
        required
        description="Add one row per metric, or load from a saved dataset."
      >
        {({ field }) => (
          <MetricsEditor
            value={field.value ?? {}}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="period" label="Period">
        {({ field }) => (
          <div className="flex gap-1.5">
            {REX_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => field.onChange(p)}
                className={cn(
                  "flex-1 border border-border px-2 py-1.5 text-xs capitalize",
                  (field.value ?? "monthly") === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Forecast ───────────────────────────────────────────────────────────────

export function RexForecastForm({
  value,
  onChange,
}: {
  value: RexForecastValues
  onChange: (patch: Partial<RexForecastValues>) => void
}) {
  const form = useAgentForm({
    schema: rexForecastSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="metric_name"
        label="Metric name"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. mrr"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="historical_data"
        label="Historical data"
        required
        description="Select a saved dataset to auto-fill both data and metric name. At least 6 points recommended."
      >
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              onSelect={(pts, ds) => {
                field.onChange(pts)
                form.setValue("metric_name", ds.metricKey)
              }}
              label="Load from dataset (auto-fills name)"
            />
            <DataPointTable
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </div>
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="horizon_days"
        label="Horizon (days)"
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={7}
            max={365}
            value={field.value ?? 90}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Financial analysis ─────────────────────────────────────────────────────

export function RexFinancialAnalysisForm({
  value,
  onChange,
}: {
  value: RexFinancialAnalysisValues
  onChange: (patch: Partial<RexFinancialAnalysisValues>) => void
}) {
  const form = useAgentForm({
    schema: rexFinancialAnalysisSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="revenue_data"
        label="Revenue"
        required
      >
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              metricHints={["mrr", "revenue", "arr"]}
              onSelect={(pts) => field.onChange(pts)}
              label="Load revenue dataset"
            />
            <DataPointTable
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </div>
        )}
      </RhfField>

      <RhfField control={form.control} name="expenses_data" label="Expenses">
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              metricHints={["expenses", "burn", "marketing_spend"]}
              onSelect={(pts) => field.onChange(pts)}
              label="Load expenses dataset"
            />
            <DataPointTable
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </div>
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="subscribers_data"
        label="Subscribers"
      >
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              metricHints={["subscribers", "new_customers"]}
              onSelect={(pts) => field.onChange(pts)}
              label="Load subscribers dataset"
            />
            <DataPointTable
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </div>
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Runway ─────────────────────────────────────────────────────────────────

export function RexRunwayForm({
  value,
  onChange,
}: {
  value: RexRunwayValues
  onChange: (patch: Partial<RexRunwayValues>) => void
}) {
  const form = useAgentForm({ schema: rexRunwaySchema, defaultValue: value, onChange })
  return (
    <FieldGroup>
      <RhfField control={form.control} name="cash_on_hand" label="Cash on hand ($)" required>
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            placeholder="e.g. 750000"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
      <RhfField control={form.control} name="monthly_burn" label="Monthly burn ($)" required>
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            placeholder="e.g. 48000"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
      <RhfField control={form.control} name="monthly_revenue" label="Monthly revenue ($)">
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            value={field.value ?? 0}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            placeholder="e.g. 62000"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
      <RhfField control={form.control} name="growth_rate_pct" label="MoM revenue growth (%)">
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            max={200}
            step={0.1}
            value={field.value ?? 0}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            placeholder="e.g. 8"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Unit economics ─────────────────────────────────────────────────────────

export function RexUnitEconomicsForm({
  value,
  onChange,
}: {
  value: RexUnitEconomicsValues
  onChange: (patch: Partial<RexUnitEconomicsValues>) => void
}) {
  const form = useAgentForm({ schema: rexUnitEconomicsSchema, defaultValue: value, onChange })
  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="marketing_spend"
        label="Marketing spend"
        required
        description="Monthly marketing/acquisition spend."
      >
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              metricHints={["marketing_spend", "expenses", "burn"]}
              onSelect={(pts) => field.onChange(pts)}
              label="Load spend dataset"
            />
            <DataPointTable value={field.value ?? []} onChange={field.onChange} />
          </div>
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="new_customers"
        label="New customers"
        required
        description="Monthly new customer count."
      >
        {({ field }) => (
          <div className="flex flex-col gap-1.5">
            <DatasetPicker
              metricHints={["new_customers", "subscribers"]}
              onSelect={(pts) => field.onChange(pts)}
              label="Load customers dataset"
            />
            <DataPointTable value={field.value ?? []} onChange={field.onChange} />
          </div>
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="avg_monthly_revenue_per_customer"
        label="Avg monthly revenue per customer ($)"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            step={0.01}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            placeholder="e.g. 175"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="avg_customer_lifetime_months"
        label="Avg customer lifetime (months)"
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            value={field.value ?? 24}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Scenario ───────────────────────────────────────────────────────────────

type ScenarioEntry = { name: string; changes: { burn_delta?: number; mrr_delta?: number; growth_rate_override?: number } }

export function RexScenarioForm({
  value,
  onChange,
}: {
  value: RexScenarioValues
  onChange: (patch: Partial<RexScenarioValues>) => void
}) {
  const form = useAgentForm({ schema: rexScenarioSchema, defaultValue: value, onChange })

  return (
    <FieldGroup>
      <div className="border border-border bg-muted/20 p-2">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Base metrics
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <RhfField control={form.control} name="base_metrics.mrr" label="MRR ($)" required>
            {({ field, invalid, id }) => (
              <Input id={id} type="number" min={0} value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))} onBlur={field.onBlur}
                placeholder="e.g. 62000" aria-invalid={invalid} />
            )}
          </RhfField>
          <RhfField control={form.control} name="base_metrics.burn" label="Burn ($)" required>
            {({ field, invalid, id }) => (
              <Input id={id} type="number" min={0} value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))} onBlur={field.onBlur}
                placeholder="e.g. 48000" aria-invalid={invalid} />
            )}
          </RhfField>
          <RhfField control={form.control} name="base_metrics.cash" label="Cash ($)" required>
            {({ field, invalid, id }) => (
              <Input id={id} type="number" min={0} value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))} onBlur={field.onBlur}
                placeholder="e.g. 750000" aria-invalid={invalid} />
            )}
          </RhfField>
          <RhfField control={form.control} name="base_metrics.growth_rate" label="Growth rate (0-1)">
            {({ field, invalid, id }) => (
              <Input id={id} type="number" min={0} max={1} step={0.01} value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))} onBlur={field.onBlur}
                placeholder="e.g. 0.08" aria-invalid={invalid} />
            )}
          </RhfField>
        </div>
      </div>

      <Controller
        control={form.control}
        name="scenarios"
        render={({ field }) => {
          const entries: ScenarioEntry[] = field.value ?? []
          const commit = (next: ScenarioEntry[]) => field.onChange(next)
          const addTemplate = (name: string, changes: ScenarioEntry["changes"]) =>
            commit([...entries, { name, changes }])

          const TEMPLATES: Array<{ label: string; changes: ScenarioEntry["changes"] }> = [
            { label: "Hire 2 engineers", changes: { burn_delta: 25000 } },
            { label: "Double marketing", changes: { burn_delta: 10000, mrr_delta: 5000 } },
            { label: "Price increase 20%", changes: { mrr_delta: 5000 } },
            { label: "Cut $10K burn", changes: { burn_delta: -10000 } },
          ]

          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                  Scenarios
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => addTemplate(t.label, t.changes)}
                      className="border border-dashed border-border bg-muted/20 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {entries.map((entry, i) => (
                <div key={i} className="flex flex-col gap-1.5 border border-border bg-muted/20 p-2">
                  <div className="flex gap-1.5">
                    <Input
                      value={entry.name}
                      placeholder="e.g. Hire 2 engineers"
                      onChange={(e) =>
                        commit(entries.map((x, j) => j === i ? { ...x, name: e.target.value } : x))
                      }
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                      onClick={() => commit(entries.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <p className="mb-0.5 text-[10px] text-muted-foreground">Burn delta ($)</p>
                      <Input type="number" value={entry.changes.burn_delta ?? ""}
                        placeholder="e.g. +20000"
                        onChange={(e) => commit(entries.map((x, j) =>
                          j === i ? { ...x, changes: { ...x.changes, burn_delta: e.target.value === "" ? undefined : Number(e.target.value) } } : x
                        ))} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] text-muted-foreground">MRR delta ($)</p>
                      <Input type="number" value={entry.changes.mrr_delta ?? ""}
                        placeholder="e.g. +5000"
                        onChange={(e) => commit(entries.map((x, j) =>
                          j === i ? { ...x, changes: { ...x.changes, mrr_delta: e.target.value === "" ? undefined : Number(e.target.value) } } : x
                        ))} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] text-muted-foreground">Growth override</p>
                      <Input type="number" step={0.01} min={0} max={1} value={entry.changes.growth_rate_override ?? ""}
                        placeholder="e.g. 0.05"
                        onChange={(e) => commit(entries.map((x, j) =>
                          j === i ? { ...x, changes: { ...x.changes, growth_rate_override: e.target.value === "" ? undefined : Number(e.target.value) } } : x
                        ))} />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...entries, { name: "", changes: {} }])}
                className="self-start">
                <Plus data-icon="inline-start" /> Add scenario
              </Button>
            </div>
          )
        }}
      />
    </FieldGroup>
  )
}

// ─── Metric KV editor ────────────────────────────────────────────────────────
// Maintains local entry state so empty-named rows persist after "Add metric"
// (the RHF commit filters out empty-key entries, making new rows vanish).

function MetricKVEditor({
  value,
  onChange,
  label,
  hint,
}: {
  value: Record<string, number>
  onChange: (v: Record<string, number>) => void
  label: string
  hint?: string
}) {
  const [entries, setEntries] = React.useState<[string, number][]>(() =>
    Object.entries(value ?? {})
  )

  const prevRef = React.useRef(value)
  React.useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value
      setEntries(Object.entries(value ?? {}))
    }
  }, [value])

  const commit = (next: [string, number][]) => {
    setEntries(next)
    onChange(Object.fromEntries(next.filter(([k]) => k.trim())))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            value={k}
            placeholder="metric name"
            onChange={(e) =>
              commit(entries.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))
            }
          />
          <Input
            type="number"
            value={v}
            placeholder="value"
            onChange={(e) =>
              commit(entries.map((x, j) => (j === i ? [x[0], Number(e.target.value)] : x)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove"
            onClick={() => commit(entries.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      {/* "Add metric" only updates local state so the empty row is not filtered away */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEntries((prev) => [...prev, ["", 0]])}
        className="self-start"
      >
        <Plus data-icon="inline-start" /> Add metric
      </Button>
    </div>
  )
}

// ─── Weekly digest ───────────────────────────────────────────────────────────

export function RexWeeklyDigestForm({
  value,
  onChange,
}: {
  value: RexWeeklyDigestValues
  onChange: (patch: Partial<RexWeeklyDigestValues>) => void
}) {
  const form = useAgentForm({ schema: rexWeeklyDigestSchema, defaultValue: value, onChange })

  return (
    <FieldGroup>
      <Controller
        control={form.control}
        name="metrics"
        render={({ field }) => (
          <MetricKVEditor
            value={field.value ?? {}}
            onChange={field.onChange}
            label="This week's metrics"
            hint="Keys: mrr, arr, burn, cash, churn_rate, growth_rate, new_customers, cac, ltv"
          />
        )}
      />
      <Controller
        control={form.control}
        name="prev_week"
        render={({ field }) => (
          <MetricKVEditor
            value={field.value ?? {}}
            onChange={field.onChange}
            label="Last week's metrics (optional)"
          />
        )}
      />
    </FieldGroup>
  )
}

// ─── Investor update ─────────────────────────────────────────────────────────

export function RexInvestorUpdateForm({
  value,
  onChange,
}: {
  value: RexInvestorUpdateValues
  onChange: (patch: Partial<RexInvestorUpdateValues>) => void
}) {
  const form = useAgentForm({ schema: rexInvestorUpdateSchema, defaultValue: value, onChange })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="period" label="Period" required>
        {({ field, invalid, id }) => (
          <Input {...field} id={id} placeholder="e.g. April 2026" aria-invalid={invalid} />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="highlights"
        render={({ field }) => {
          const items: string[] = field.value ?? []
          const commit = (next: string[]) => field.onChange(next)
          return (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                Highlights
              </span>
              {items.map((item, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={item} placeholder="e.g. Crossed $58K MRR"
                    onChange={(e) => commit(items.map((x, j) => j === i ? e.target.value : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(items.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...items, ""])} className="self-start">
                <Plus data-icon="inline-start" /> Add highlight
              </Button>
            </div>
          )
        }}
      />

      <Controller
        control={form.control}
        name="asks"
        render={({ field }) => {
          const items: string[] = field.value ?? []
          const commit = (next: string[]) => field.onChange(next)
          return (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                Asks (where investors can help)
              </span>
              {items.map((item, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={item} placeholder="e.g. Introductions to Series A firms"
                    onChange={(e) => commit(items.map((x, j) => j === i ? e.target.value : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(items.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...items, ""])} className="self-start">
                <Plus data-icon="inline-start" /> Add ask
              </Button>
            </div>
          )
        }}
      />
    </FieldGroup>
  )
}

// ─── Variance (C9) ──────────────────────────────────────────────────────────

export function RexVarianceForm({
  value,
  onChange,
}: {
  value: RexVarianceValues
  onChange: (patch: Partial<RexVarianceValues>) => void
}) {
  const form = useAgentForm({ schema: rexVarianceSchema, defaultValue: value, onChange })
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  const actualKeys = new Set(
    datasets.filter((d) => d.purpose === "actual").map((d) => d.metricKey)
  )
  const budgetKeys = new Set(
    datasets.filter((d) => d.purpose === "budget").map((d) => d.metricKey)
  )
  const metricKeys = Array.from(actualKeys).filter((k) => budgetKeys.has(k)).sort()

  return (
    <FieldGroup>
      <RhfField control={form.control} name="metric" label="Metric" required
        description="Only metrics with BOTH an 'actual' and a 'budget' dataset appear here.">
        {({ field }) => (
          metricKeys.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No metrics have both actual and budget datasets yet. Upload your data in the Data tab and tag one dataset as &ldquo;budget&rdquo;.
            </p>
          ) : (
            <select
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              className="h-9 w-full border border-border bg-background px-2 text-xs"
            >
              <option value="" disabled>Select a metric…</option>
              {metricKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )
        )}
      </RhfField>
      <RhfField control={form.control} name="period" label="Period">
        {({ field }) => (
          <div className="flex gap-1.5">
            {REX_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => field.onChange(p)}
                className={cn(
                  "flex-1 border border-border px-2 py-1.5 text-xs capitalize",
                  (field.value ?? "monthly") === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Board deck (C5) ────────────────────────────────────────────────────────

export function RexBoardDeckForm({
  value,
  onChange,
}: {
  value: RexBoardDeckValues
  onChange: (patch: Partial<RexBoardDeckValues>) => void
}) {
  const form = useAgentForm({ schema: rexBoardDeckSchema, defaultValue: value, onChange })
  return (
    <FieldGroup>
      <RhfField control={form.control} name="period" label="Period" required>
        {({ field, invalid, id }) => (
          <Input {...field} id={id} placeholder="e.g. Q1 2026" aria-invalid={invalid} />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="highlights"
        render={({ field }) => {
          const items: string[] = field.value ?? []
          const commit = (next: string[]) => field.onChange(next)
          return (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                Highlights
              </span>
              {items.map((item, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={item} placeholder="e.g. Crossed $62K MRR"
                    onChange={(e) => commit(items.map((x, j) => j === i ? e.target.value : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(items.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...items, ""])} className="self-start">
                <Plus data-icon="inline-start" /> Add highlight
              </Button>
            </div>
          )
        }}
      />

      <Controller
        control={form.control}
        name="risks"
        render={({ field }) => {
          const items: string[] = field.value ?? []
          const commit = (next: string[]) => field.onChange(next)
          return (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                Risks
              </span>
              {items.map((item, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={item} placeholder="e.g. Enterprise sales cycle slowing"
                    onChange={(e) => commit(items.map((x, j) => j === i ? e.target.value : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(items.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...items, ""])} className="self-start">
                <Plus data-icon="inline-start" /> Add risk
              </Button>
            </div>
          )
        }}
      />

      <RhfField control={form.control} name="ask" label="Key ask">
        {({ field, invalid, id }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={3}
            onChange={(v) => field.onChange(v)}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Briefing ───────────────────────────────────────────────────────────────

// ─── Agent summary editor ────────────────────────────────────────────────────
// Local state so the "Add" button shows an empty row before the user types a
// name (same pattern as MetricKVEditor — the commit filter strips empty keys).

function AgentSummaryEditor({
  value,
  onChange,
}: {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  const [entries, setEntries] = React.useState<[string, string][]>(() =>
    Object.entries(value ?? {})
  )

  const prevRef = React.useRef(value)
  React.useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value
      setEntries(Object.entries(value ?? {}))
    }
  }, [value])

  const commit = (next: [string, string][]) => {
    setEntries(next)
    onChange(Object.fromEntries(next.filter(([k]) => k.trim())))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
          Agent summaries
        </span>
        <span className="text-[10px] text-muted-foreground">
          Paste each agent&apos;s status note.
        </span>
      </div>
      {entries.map(([name, summary], i) => (
        <div key={i} className="flex flex-col gap-1.5 border border-border bg-muted/20 p-2">
          <div className="flex gap-1.5">
            <Input
              value={name}
              placeholder="Agent (sage, maya, scout…)"
              onChange={(e) =>
                commit(entries.map((x, j) => j === i ? [e.target.value, x[1]] : x))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => commit(entries.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </div>
          <CountedTextarea
            value={summary}
            rows={2}
            onChange={(v) =>
              commit(entries.map((x, j) => j === i ? [x[0], v] : x))
            }
          />
        </div>
      ))}
      {/* Add only updates local state so the empty row is not immediately filtered */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEntries((prev) => [...prev, ["", ""]])}
        className="self-start"
      >
        <Plus data-icon="inline-start" /> Add agent summary
      </Button>
    </div>
  )
}

export function RexBriefingForm({
  value,
  onChange,
}: {
  value: RexBriefingValues
  onChange: (patch: Partial<RexBriefingValues>) => void
}) {
  const form = useAgentForm({
    schema: rexBriefingSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="date" label="Date" required>
        {({ field, invalid, id }) => (
          <Input {...field} id={id} type="date" aria-invalid={invalid} />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="agent_summaries"
        render={({ field }) => (
          <AgentSummaryEditor
            value={field.value ?? {}}
            onChange={field.onChange}
          />
        )}
      />
    </FieldGroup>
  )
}

// ─── Ask REX about any dataset ────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Summarize this dataset",
  "Show me a bar chart",
  "What are the trends?",
  "Find anomalies or outliers",
  "What is the average value?",
  "Which category has the highest value?",
  "Compare columns",
  "Show top 10 rows",
]

export function RexQueryDatasetForm({
  initialDatasetId,
  onResult,
}: {
  initialDatasetId?: string
  onResult?: (result: RexQueryDatasetResult, datasetName: string, query: string) => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  const [selectedDatasetId, setSelectedDatasetId] = React.useState(initialDatasetId ?? "")
  const [query, setQuery] = React.useState("")

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)

  // Generate contextual suggestions based on detected column types
  const suggestions = React.useMemo(() => {
    if (!selectedDataset?.meta?.rawTable) return SUGGESTED_QUESTIONS.slice(0, 4)
    const ct = selectedDataset.meta.rawTable.columnTypes
    const hasDate = Object.values(ct).includes("date")
    const hasNumeric = Object.values(ct).includes("numeric")
    const hasCategorical = Object.values(ct).includes("categorical")
    const numericCols = Object.entries(ct).filter(([, t]) => t === "numeric").map(([k]) => k)
    const catCols = Object.entries(ct).filter(([, t]) => t === "categorical").map(([k]) => k)
    const out: string[] = ["Summarize this dataset"]
    if (hasDate && hasNumeric) out.push("What are the trends over time?")
    if (hasNumeric) out.push(`Show me a chart of ${numericCols[0] ?? "values"}`)
    if (hasCategorical && hasNumeric) out.push(`Which ${catCols[0] ?? "category"} has the highest ${numericCols[0] ?? "value"}?`)
    if (numericCols.length >= 2) out.push(`Compare ${numericCols[0]} vs ${numericCols[1]}`)
    out.push("Find anomalies or outliers")
    return out.slice(0, 5)
  }, [selectedDataset])

  const mutation = useMutation({
    mutationFn: () => queryDataset(selectedDatasetId, { query }),
    onSuccess: (result) => {
      onResult?.(result, selectedDataset?.name ?? "", query)
      setQuery("")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDatasetId || !query.trim()) return
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Dataset picker */}
      <div>
        <p className="mb-1 text-[10px] text-muted-foreground">Dataset</p>
        <div className="relative">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="w-full appearance-none border border-border bg-background px-2 py-1.5 pr-6 text-[12px]"
          >
            <option value="" disabled>Select a dataset…</option>
            {datasets.map((d) => {
              const rowCount = d.meta?.rawTable?.rows?.length ?? d.points.length
              return (
                <option key={d.id} value={d.id}>
                  {d.name} — {rowCount} rows
                </option>
              )
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Column type info */}
      {selectedDataset?.meta?.rawTable && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(selectedDataset.meta.rawTable.columnTypes).map(([col, type]) => (
            <span
              key={col}
              className="border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
            >
              {col}
              <span className={cn(
                "ml-1",
                type === "date" && "text-blue-500",
                type === "numeric" && "text-green-600",
                type === "categorical" && "text-purple-500",
              )}>
                {type === "date" ? "📅" : type === "numeric" ? "#" : type === "categorical" ? "Aa" : "T"}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Suggested questions */}
      {selectedDatasetId && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              className={cn(
                "border border-dashed border-border px-2 py-0.5 text-[10px] hover:bg-muted",
                query === s && "border-solid border-primary bg-primary/5 text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Question input */}
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your data… e.g. 'Show me a bar chart of sales by region'"
          rows={3}
          className="w-full resize-none border border-border bg-background p-2 pr-10 text-[12px] placeholder:text-muted-foreground focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent)
          }}
        />
        <button
          type="submit"
          disabled={!selectedDatasetId || !query.trim() || mutation.isPending}
          className="absolute bottom-2 right-2 flex items-center gap-1 border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted disabled:opacity-40"
        >
          {mutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          Ask
        </button>
      </div>

      {mutation.isError && (
        <p className="text-[11px] text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Something went wrong"}
        </p>
      )}

      {/* Sparkles hint */}
      {!selectedDatasetId && datasets.length === 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" />
          Upload a CSV or Excel file in the Data tab to get started
        </p>
      )}
    </form>
  )
}

// ─── Action-dialog form: Ask about a dataset ──────────────────────────────────
// Uses {value, onChange} pattern for RunActionDialog

export function RexQueryDatasetActionForm({
  value,
  onChange,
}: {
  value: RexQueryDatasetValues
  onChange: (patch: Partial<RexQueryDatasetValues>) => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  const selected = datasets.find((d) => d.id === value.dataset_id)
  const ct = selected?.meta?.rawTable?.columnTypes ?? {}
  const numCols = Object.entries(ct).filter(([, t]) => t === "numeric").map(([k]) => k)
  const catCols = Object.entries(ct).filter(([, t]) => t === "categorical").map(([k]) => k)
  const hasDate = Object.values(ct).includes("date")

  const suggestions: string[] = ["Summarize this dataset"]
  if (hasDate && numCols.length) suggestions.push("What are the trends over time?")
  if (numCols.length) suggestions.push(`Show me a ${hasDate ? "line" : "bar"} chart`)
  if (catCols.length && numCols.length) suggestions.push(`Which ${catCols[0]} has the highest ${numCols[0]}?`)
  if (numCols.length >= 2) suggestions.push(`Compare ${numCols[0]} vs ${numCols[1]}`)
  suggestions.push("Find anomalies or outliers")

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-[10px] text-muted-foreground">Dataset</p>
        <div className="relative">
          <select
            value={value.dataset_id}
            onChange={(e) => onChange({ dataset_id: e.target.value })}
            className="w-full appearance-none border border-border bg-background px-2 py-1.5 pr-6 text-[12px]"
          >
            <option value="" disabled>Select a dataset…</option>
            {datasets.map((d) => {
              const rows = d.meta?.rawTable?.rows?.length ?? d.points.length
              return (
                <option key={d.id} value={d.id}>
                  {d.name} — {rows} rows
                </option>
              )
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {value.dataset_id && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ query: s })}
              className={cn(
                "border border-dashed border-border px-2 py-0.5 text-[10px] hover:bg-muted",
                value.query === s && "border-solid border-primary bg-primary/5 text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] text-muted-foreground">Your question</p>
        <textarea
          value={value.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Ask anything about your data…"
          rows={3}
          className="w-full resize-none border border-border bg-background p-2 text-[12px] placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  )
}

// ─── Action-dialog form: Analyze dataset ─────────────────────────────────────

export function RexAnalyzeDatasetForm({
  value,
  onChange,
}: {
  value: RexAnalyzeDatasetValues
  onChange: (patch: Partial<RexAnalyzeDatasetValues>) => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 border border-border bg-muted/20 p-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-[12px] font-medium">Automatic deep analysis</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            REX will analyze your entire dataset and generate business insights, patterns, statistics, and strategic recommendations — no question needed.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] text-muted-foreground">Dataset to analyze</p>
        <div className="relative">
          <select
            value={value.dataset_id}
            onChange={(e) => onChange({ dataset_id: e.target.value })}
            className="w-full appearance-none border border-border bg-background px-2 py-1.5 pr-6 text-[12px]"
          >
            <option value="" disabled>Select a dataset…</option>
            {datasets.map((d) => {
              const rows = d.meta?.rawTable?.rows?.length ?? d.points.length
              const cols = d.meta?.rawTable?.headers?.length ?? 1
              return (
                <option key={d.id} value={d.id}>
                  {d.name} — {rows} rows × {cols} columns
                </option>
              )
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {value.dataset_id && (() => {
        const ds = datasets.find((d) => d.id === value.dataset_id)
        const ct = ds?.meta?.rawTable?.columnTypes ?? {}
        if (!Object.keys(ct).length) return null
        return (
          <div className="flex flex-wrap gap-1">
            {Object.entries(ct).map(([col, type]) => (
              <span
                key={col}
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[9px]",
                  type === "date" && "border-blue-200 bg-blue-50 text-blue-700",
                  type === "numeric" && "border-green-200 bg-green-50 text-green-700",
                  type === "categorical" && "border-purple-200 bg-purple-50 text-purple-700",
                  type === "text" && "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {col} <span className="opacity-60">({type})</span>
              </span>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Generate Dataset Report ──────────────────────────────────────────────────

export interface RexGenerateReportValues {
  dataset_id: string
}

export function RexGenerateReportForm({
  value,
  onChange,
}: {
  value: RexGenerateReportValues
  onChange: (patch: Partial<RexGenerateReportValues>) => void
}) {
  const { data: datasets = [] } = useQuery<RexDatasetRecord[]>({
    queryKey: REX_DATASETS_QK,
    queryFn: listDatasets,
    staleTime: 30_000,
  })

  const [generating, setGenerating] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const handleGenerate = async () => {
    if (!value.dataset_id) return
    setGenerating(true)
    setDone(false)
    try {
      const res = await generateDatasetReport(value.dataset_id, "docx")
      const bytes = Uint8Array.from(atob(res.file_b64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: res.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } finally {
      setGenerating(false)
    }
  }

  const selected = datasets.find((d) => d.id === value.dataset_id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 border border-border bg-muted/20 p-3">
        <FileDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-[12px] font-medium">Full analytical report</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            REX will profile the dataset, plan 5–7 chart sections with AI narratives, and export a ready-to-share DOCX report.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] text-muted-foreground">Dataset to report on</p>
        <div className="relative">
          <select
            value={value.dataset_id}
            onChange={(e) => { onChange({ dataset_id: e.target.value }); setDone(false) }}
            className="w-full appearance-none border border-border bg-background px-2 py-1.5 pr-6 text-[12px]"
          >
            <option value="" disabled>Select a dataset…</option>
            {datasets.map((d) => {
              const rows = d.meta?.rawTable?.rows?.length ?? d.points.length
              const cols = d.meta?.rawTable?.headers?.length ?? 1
              const sheetCount = d.meta?.rawTable?.sheets ? Object.keys(d.meta.rawTable.sheets).length : null
              return (
                <option key={d.id} value={d.id}>
                  {d.name} — {sheetCount ? `${sheetCount} sheets · ` : ""}{rows} rows × {cols} cols
                </option>
              )
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {selected && (
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="flex items-center justify-center gap-2 border border-border bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {generating
            ? <><Loader2 className="size-3.5 animate-spin" /> Generating report…</>
            : done
              ? <><FileDown className="size-3.5" /> Downloaded — generate again?</>
              : <><FileDown className="size-3.5" /> Generate &amp; download report</>
          }
        </button>
      )}

      {done && (
        <p className="text-center text-[11px] text-green-600">
          Report downloaded successfully.
        </p>
      )}
    </div>
  )
}
