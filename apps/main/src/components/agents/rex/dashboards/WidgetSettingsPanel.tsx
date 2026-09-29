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
import { CHART_COLORS } from "./WidgetView"

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "scatter", label: "Scatter" },
]

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
      {CHART_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className="size-5 rounded-full border-2"
          style={{ background: c, borderColor: value === c ? "var(--foreground)" : "transparent" }}
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
                  <Field label={chart.type === "pie" ? "Slices" : "X axis"}>
                    <Select value={chart.xKey ?? columns[0]} onValueChange={(v) => v && setChart({ xKey: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={chart.type === "pie" ? "Value" : "Series"}>
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
                                      ? [...yKeys, { key: c, label: c.replace(/_/g, " "), color: CHART_COLORS[yKeys.length % CHART_COLORS.length] }]
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
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Field>
                  {(chart.type === "bar" || chart.type === "area") && yKeys.length > 1 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!chart.stacked} onCheckedChange={(v) => setChart({ stacked: !!v })} />
                      Stack series
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
