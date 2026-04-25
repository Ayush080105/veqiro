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
