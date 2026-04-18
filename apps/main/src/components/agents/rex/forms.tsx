"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  FormRow,
  DataPointTable,
  CountedTextarea,
} from "@/components/chat/ActionForm/fields"
import { cn } from "@/lib/utils"
import type {
  RexAnalyzeMetricsRequest,
  RexForecastRequest,
  RexFinancialAnalysisRequest,
  RexBriefingRequest,
  DataPoint,
} from "@/lib/types/agents"

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

export function RexAnalyzeMetricsForm({
  value,
  onChange,
}: {
  value: RexAnalyzeMetricsRequest
  onChange: (patch: Partial<RexAnalyzeMetricsRequest>) => void
}) {
  const entries = React.useMemo(
    () => metricsMapToEntries(value.metrics ?? {}),
    [value.metrics]
  )
  const commit = (next: MetricEntry[]) =>
    onChange({ metrics: entriesToMetricsMap(next) })

  const periods: Array<"daily" | "weekly" | "monthly" | "quarterly"> = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
  ]

  return (
    <>
      <FormRow label="Metrics" required hint="Add one row per metric you track.">
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
                  onClick={() =>
                    commit(entries.filter((_, j) => j !== i))
                  }
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
      </FormRow>
      <FormRow label="Period">
        <div className="flex gap-1.5">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ period: p })}
              className={cn(
                "flex-1 border border-border px-2 py-1.5 text-xs capitalize",
                (value.period ?? "monthly") === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </FormRow>
    </>
  )
}

export function RexForecastForm({
  value,
  onChange,
}: {
  value: RexForecastRequest
  onChange: (patch: Partial<RexForecastRequest>) => void
}) {
  return (
    <>
      <FormRow label="Metric name" required>
        <Input
          value={value.metric_name}
          placeholder="e.g. mrr"
          onChange={(e) => onChange({ metric_name: e.target.value })}
        />
      </FormRow>
      <FormRow
        label="Historical data"
        required
        hint="At least 6 data points recommended for a meaningful forecast."
      >
        <DataPointTable
          value={value.historical_data ?? []}
          onChange={(next) => onChange({ historical_data: next })}
        />
      </FormRow>
      <FormRow label="Horizon (days)">
        <Input
          type="number"
          min={7}
          max={365}
          value={value.horizon_days ?? 90}
          onChange={(e) =>
            onChange({ horizon_days: Number(e.target.value) })
          }
        />
      </FormRow>
    </>
  )
}

export function RexFinancialAnalysisForm({
  value,
  onChange,
}: {
  value: RexFinancialAnalysisRequest
  onChange: (patch: Partial<RexFinancialAnalysisRequest>) => void
}) {
  return (
    <>
      <FormRow label="Revenue" required>
        <DataPointTable
          value={value.revenue_data ?? []}
          onChange={(next) => onChange({ revenue_data: next })}
        />
      </FormRow>
      <FormRow label="Expenses">
        <DataPointTable
          value={value.expenses_data ?? []}
          onChange={(next) => onChange({ expenses_data: next })}
        />
      </FormRow>
      <FormRow label="Subscribers">
        <DataPointTable
          value={value.subscribers_data ?? []}
          onChange={(next) => onChange({ subscribers_data: next })}
        />
      </FormRow>
    </>
  )
}

export function RexBriefingForm({
  value,
  onChange,
}: {
  value: RexBriefingRequest
  onChange: (patch: Partial<RexBriefingRequest>) => void
}) {
  const agentEntries = React.useMemo(
    () => Object.entries(value.agent_summaries ?? {}),
    [value.agent_summaries]
  )
  const commitAgents = (entries: [string, string][]) =>
    onChange({
      agent_summaries: Object.fromEntries(
        entries.filter(([k]) => k.trim())
      ),
    })

  return (
    <>
      <FormRow label="Date" required>
        <Input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </FormRow>
      <FormRow label="Agent summaries" hint="Paste each agent's status note.">
        <div className="flex flex-col gap-2">
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
                    agentEntries.map((x, j) => (j === i ? [x[0], v] : x))
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
      </FormRow>
    </>
  )
}
