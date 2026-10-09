"use client"

import * as React from "react"
import { Copy, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type {
  ChartType,
  ChartYKey,
  DashboardFilter,
  DashboardWidget,
  WidgetResult,
  WidgetSpec,
} from "@/lib/api/rexDashboards"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { SERIES_SLOTS, seriesColor } from "./WidgetView"

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "combo", label: "Bars + lines (same unit)" },
  { value: "ranked", label: "Ranked bars (top 10)" },
  { value: "waterfall", label: "Waterfall (bridge)" },
  { value: "funnel", label: "Funnel (stages)" },
  { value: "heatmap", label: "Heatmap (two dimensions)" },
  { value: "treemap", label: "Treemap (parts of a total)" },
  { value: "progress", label: "Progress vs target" },
  { value: "pie", label: "Donut" },
  { value: "scatter", label: "Scatter" },
]

/** Forms that plot one measure per row: a value picker instead of series checkboxes. */
const SINGLE_MEASURE = new Set<ChartType>(["waterfall", "funnel", "treemap", "ranked", "heatmap", "progress", "pie"])

const X_LABEL: Partial<Record<ChartType, string>> = {
  pie: "Slices", funnel: "Stages", ranked: "Items", treemap: "Parts", heatmap: "Columns",
  waterfall: "Steps", progress: "Rows",
}

export interface WidgetPatch {
  title?: string
  spec?: WidgetSpec
  sql?: string
  filterIds?: string[]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Swatches({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SERIES_SLOTS.map((slot, i) => (
        <button
          key={slot}
          type="button"
          aria-label={`Colour ${i + 1}`}
          aria-pressed={value === slot}
          onClick={() => onChange(slot)}
          className="size-5 rounded-full border-2"
          style={{ background: seriesColor(slot, i), borderColor: value === slot ? "var(--foreground)" : "transparent" }}
        />
      ))}
    </div>
  )
}

/**
 * Manual settings for one tile. Display changes (type, axes, colors, format) apply without
 * touching data; a changed query is run by the server first and refused if it fails.
 */
export function WidgetSettingsPanel({
  widget,
  result,
  filters,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onDuplicate,
  onAskRex,
  saving,
}: {
  widget: DashboardWidget | null
  result?: WidgetResult
  filters: DashboardFilter[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (patch: WidgetPatch) => Promise<unknown>
  onDelete: () => void
  onDuplicate: () => void
  onAskRex: (prompt: string) => void
  saving?: boolean
}) {
  const [draft, setDraft] = React.useState<DashboardWidget | null>(widget)
  const [ask, setAsk] = React.useState("")
  const [showSql, setShowSql] = React.useState(false)

  React.useEffect(() => {
    setDraft(widget)
    setAsk("")
    setShowSql(false)
  }, [widget])

  if (!widget || !draft) return null
  const columns = result?.columns ?? []
  const chart = draft.spec.chart ?? {}
  const kpi = draft.spec.kpi ?? {}
  const yKeys: ChartYKey[] = chart.yKeys ?? []

  const setSpec = (spec: WidgetSpec) => setDraft({ ...draft, spec: { ...draft.spec, ...spec } })
  const setChart = (c: Partial<NonNullable<WidgetSpec["chart"]>>) => setSpec({ chart: { ...chart, ...c } })
  const setKpi = (k: Partial<NonNullable<WidgetSpec["kpi"]>>) => setSpec({ kpi: { ...kpi, ...k } })

  const save = async () => {
    const patch: WidgetPatch = {}
    if (draft.title !== widget.title) patch.title = draft.title
    if (JSON.stringify(draft.spec) !== JSON.stringify(widget.spec)) patch.spec = draft.spec
    if ((draft.sql ?? "") !== (widget.sql ?? "")) patch.sql = draft.sql ?? ""
    if ([...draft.filterIds].sort().join() !== [...widget.filterIds].sort().join()) patch.filterIds = draft.filterIds
    if (!Object.keys(patch).length) {
      onOpenChange(false)
      return
    }
    try {
      await onSave(patch)
      toast.success("Saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Tile settings</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
          </Field>

          {draft.kind === "chart" && (
            <>
              <Field label="Chart type">
                <Select value={chart.type ?? "bar"} onValueChange={(v) => v && setChart({ type: v as ChartType })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {columns.length > 0 && (
                <>
                  <Field label={X_LABEL[chart.type ?? "bar"] ?? "X axis"}>
                    <Select value={chart.xKey ?? columns[0]} onValueChange={(v) => v && setChart({ xKey: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  {SINGLE_MEASURE.has(chart.type ?? "bar") ? (
                    <Field label={chart.type === "progress" ? "Actual" : "Value"}>
                      <Select
                        value={yKeys[0]?.key ?? ""}
                        onValueChange={(v) => v && setChart({ yKeys: [{ ...(yKeys[0] ?? {}), key: v, label: v.replace(/_/g, " ") }] })}
                      >
                        <SelectTrigger className="w-full"><SelectValue placeholder="Pick a column" /></SelectTrigger>
                        <SelectContent>
                          {columns.filter((c) => c !== chart.xKey).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                  <Field label="Series">
                    <div className="flex flex-col gap-2">
                      {columns.filter((c) => c !== chart.xKey).map((c) => {
                        const i = yKeys.findIndex((y) => y.key === c)
                        const on = i >= 0
                        return (
                          <div key={c} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={on}
                                onCheckedChange={(checked) =>
                                  setChart({
                                    yKeys: checked
                                      ? [...yKeys, { key: c, label: c.replace(/_/g, " "), color: SERIES_SLOTS[yKeys.length % SERIES_SLOTS.length] }]
                                      : yKeys.filter((y) => y.key !== c),
                                  })}
                              />
                              {c}
                            </label>
                            {on && (
                              <div className="flex flex-col gap-1.5 pl-6">
                                <Input
                                  className="h-7 text-xs"
                                  value={yKeys[i]!.label ?? ""}
                                  placeholder="Label"
                                  onChange={(e) => setChart({ yKeys: yKeys.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })}
                                />
                                <Swatches
                                  value={yKeys[i]!.color}
                                  onChange={(color) => setChart({ yKeys: yKeys.map((y, j) => (j === i ? { ...y, color } : y)) })}
                                />
                                {chart.type === "combo" && (
                                  <div className="flex gap-1">
                                    {(["bar", "line"] as const).map((as) => (
                                      <Button key={as} type="button" size="xs" variant={(yKeys[i]!.as ?? (i === 0 ? "bar" : "line")) === as ? "default" : "outline"}
                                        onClick={() => setChart({ yKeys: yKeys.map((y, j) => (j === i ? { ...y, as } : y)) })}>
                                        {as === "bar" ? "Bars" : "Line"}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                                {(chart.type === "line" || chart.type === "area" || chart.type === "combo" || chart.type === "bar") && (
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox checked={!!yKeys[i]!.ghost}
                                      onCheckedChange={(v) => setChart({ yKeys: yKeys.map((y, j) => (j === i ? { ...y, ghost: !!v } : y)) })} />
                                    Comparison series (drawn faded)
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Field>
                  )}
                  {chart.type === "heatmap" && (
                    <Field label="Rows">
                      <Select value={chart.groupKey ?? ""} onValueChange={(v) => v && setChart({ groupKey: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Pick a column" /></SelectTrigger>
                        <SelectContent>
                          {columns.filter((c) => c !== chart.xKey).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {chart.type === "progress" && (
                    <Field label="Target">
                      <Select value={chart.targetKey ?? ""} onValueChange={(v) => v && setChart({ targetKey: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Pick the goal column" /></SelectTrigger>
                        <SelectContent>
                          {columns.filter((c) => c !== chart.xKey && c !== yKeys[0]?.key).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {chart.type === "waterfall" && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!chart.baseFirst} onCheckedChange={(v) => setChart({ baseFirst: !!v })} />
                      First row is an opening balance
                    </label>
                  )}
                  {(chart.type === "bar" || chart.type === "area") && yKeys.length > 1 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!chart.stacked} onCheckedChange={(v) => setChart({ stacked: !!v, ...(v ? {} : { normalize: false }) })} />
                      Stack series
                    </label>
                  )}
                  {chart.type === "bar" && chart.stacked && yKeys.length > 1 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!chart.normalize} onCheckedChange={(v) => setChart({ normalize: !!v })} />
                      Show as shares of 100%
                    </label>
                  )}
                  {(chart.type === "line" || chart.type === "area" || chart.type === "combo" || (chart.type === "bar" && !chart.stacked)) && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={chart.reference === "average"} onCheckedChange={(v) => setChart({ reference: v ? "average" : null })} />
                      Show average line
                    </label>
                  )}
                </>
              )}
            </>
          )}

          {draft.kind === "kpi" && (
            <>
              {columns.length > 0 && (
                <Field label="Value">
                  <Select value={kpi.valueKey ?? columns[0]} onValueChange={(v) => v && setKpi({ valueKey: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {columns.length > 1 && (
                <Field label="Trend by (one row per period)">
                  <Select value={kpi.periodKey ?? "__none"} onValueChange={(v) => v && setKpi({ periodKey: v === "__none" ? null : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No trend</SelectItem>
                      {columns.filter((c) => c !== kpi.valueKey).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="A rise is">
                <Select value={kpi.goodDirection ?? "up"} onValueChange={(v) => v && setKpi({ goodDirection: v as "up" | "down" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">Good (revenue, users)</SelectItem>
                    <SelectItem value="down">Bad (costs, churn)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Format">
                <Select value={kpi.format ?? "number"} onValueChange={(v) => v && setKpi({ format: v as "number" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Prefix">
                  <Input value={kpi.prefix ?? ""} placeholder="₹" maxLength={6} onChange={(e) => setKpi({ prefix: e.target.value })} />
                </Field>
                <Field label="Suffix">
                  <Input value={kpi.suffix ?? ""} placeholder="users" maxLength={12} onChange={(e) => setKpi({ suffix: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {draft.kind === "text" && (
            <Field label="Text">
              <Textarea rows={6} value={draft.spec.text ?? ""} onChange={(e) => setSpec({ text: e.target.value })} />
            </Field>
          )}

          {filters.length > 0 && draft.kind !== "text" && (
            <Field label="Responds to filters">
              <div className="flex flex-col gap-1.5">
                {filters.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.filterIds.includes(f.id)}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          filterIds: v ? [...draft.filterIds, f.id] : draft.filterIds.filter((x) => x !== f.id),
                        })}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="rounded-md border border-dashed border-border p-3">
            <Label className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" /> Ask Rex to change this tile
            </Label>
            <div className="flex gap-2">
              <Input
                value={ask}
                placeholder="e.g. split by region, only last 6 months"
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ask.trim()) {
                    onAskRex(ask.trim())
                    onOpenChange(false)
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!ask.trim()}
                onClick={() => {
                  onAskRex(ask.trim())
                  onOpenChange(false)
                }}
              >
                Ask
              </Button>
            </div>
          </div>

          {draft.kind !== "text" && (
            <div>
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowSql((s) => !s)}>
                {showSql ? "Hide" : "Advanced:"} SQL
              </button>
              {showSql && (
                <Textarea
                  className="mt-2 font-mono text-xs"
                  rows={8}
                  value={draft.sql ?? ""}
                  onChange={(e) => setDraft({ ...draft, sql: e.target.value })}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <Button variant="ghost" size="sm" onClick={onDuplicate}><Copy className="size-3.5" /> Duplicate</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="size-3.5" /> Delete</Button>
          <span className="flex-1" />
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
