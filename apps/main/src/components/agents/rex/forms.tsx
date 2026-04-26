"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { DataPointTable, CountedTextarea } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { cn } from "@/lib/utils"
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
  REX_PERIODS,
} from "@/lib/schemas/agents/rex"
import type { DataPoint } from "@/lib/types/agents"

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
        description="Add one row per metric you track."
      >
        {({ field }) => {
          const entries = metricsMapToEntries(field.value ?? {})
          const commit = (next: MetricEntry[]) =>
            field.onChange(entriesToMetricsMap(next))
          return (
            <div className="flex flex-col gap-2">
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
                        commit(
                          entries.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x
                          )
                        )
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
                      commit(
                        entries.map((x, j) => (j === i ? { ...x, data } : x))
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => commit([...entries, { name: "", data: [] }])}
                className="self-start"
              >
                <Plus data-icon="inline-start" /> Add metric
              </Button>
            </div>
          )
        }}
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
        description="At least 6 data points recommended for a meaningful forecast."
      >
        {({ field }) => (
          <DataPointTable
            value={field.value ?? []}
            onChange={field.onChange}
          />
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
          <DataPointTable
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="expenses_data" label="Expenses">
        {({ field }) => (
          <DataPointTable
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="subscribers_data"
        label="Subscribers"
      >
        {({ field }) => (
          <DataPointTable
            value={field.value ?? []}
            onChange={field.onChange}
          />
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
          <DataPointTable value={field.value ?? []} onChange={field.onChange} />
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
          <DataPointTable value={field.value ?? []} onChange={field.onChange} />
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
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                  Scenarios
                </span>
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
        render={({ field }) => {
          const entries = Object.entries(field.value ?? {})
          const commit = (e: [string, number][]) =>
            field.onChange(Object.fromEntries(e.filter(([k]) => k.trim())))
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                  This week&apos;s metrics
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Key: mrr, arr, burn, cash, churn_rate, growth_rate, new_customers, cac, ltv
                </span>
              </div>
              {entries.map(([k, v], i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={k} placeholder="metric name"
                    onChange={(e) => commit(entries.map((x, j) => j === i ? [e.target.value, x[1]] : x))} />
                  <Input type="number" value={v} placeholder="value"
                    onChange={(e) => commit(entries.map((x, j) => j === i ? [x[0], Number(e.target.value)] : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(entries.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...entries, ["", 0]])}
                className="self-start">
                <Plus data-icon="inline-start" /> Add metric
              </Button>
            </div>
          )
        }}
      />
      <Controller
        control={form.control}
        name="prev_week"
        render={({ field }) => {
          const entries = Object.entries(field.value ?? {})
          const commit = (e: [string, number][]) =>
            field.onChange(Object.fromEntries(e.filter(([k]) => k.trim())))
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] leading-none text-foreground/70">
                  Last week&apos;s metrics (optional)
                </span>
              </div>
              {entries.map(([k, v], i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={k} placeholder="metric name"
                    onChange={(e) => commit(entries.map((x, j) => j === i ? [e.target.value, x[1]] : x))} />
                  <Input type="number" value={v} placeholder="value"
                    onChange={(e) => commit(entries.map((x, j) => j === i ? [x[0], Number(e.target.value)] : x))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove"
                    onClick={() => commit(entries.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => commit([...entries, ["", 0]])}
                className="self-start">
                <Plus data-icon="inline-start" /> Add metric
              </Button>
            </div>
          )
        }}
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

// ─── Briefing ───────────────────────────────────────────────────────────────

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
        render={({ field }) => {
          const agentEntries = Object.entries(field.value ?? {})
          const commitAgents = (entries: [string, string][]) =>
            field.onChange(
              Object.fromEntries(entries.filter(([k]) => k.trim()))
            )
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
              {agentEntries.map(([name, summary], i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 border border-border bg-muted/20 p-2"
                >
                  <div className="flex gap-1.5">
                    <Input
                      value={name}
                      placeholder="Agent (sage, maya, scout…)"
                      onChange={(e) =>
                        commitAgents(
                          agentEntries.map((x, j) =>
                            j === i ? [e.target.value, x[1]] : x
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() =>
                        commitAgents(agentEntries.filter((_, j) => j !== i))
                      }
                    >
                      <X />
                    </Button>
                  </div>
                  <CountedTextarea
                    value={summary}
                    rows={2}
                    onChange={(v) =>
                      commitAgents(
                        agentEntries.map((x, j) =>
                          j === i ? [x[0], v] : x
                        )
                      )
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => commitAgents([...agentEntries, ["", ""]])}
                className="self-start"
              >
                <Plus data-icon="inline-start" /> Add agent summary
              </Button>
            </div>
          )
        }}
      />
    </FieldGroup>
  )
}
