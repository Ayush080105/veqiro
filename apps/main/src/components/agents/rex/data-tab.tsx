"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Upload, Trash2, BarChart2, CheckCircle, AlertCircle, Loader2, TrendingUp, LineChart, DollarSign, MessageSquare, Send, FileDown } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { uploadToR2 } from "@/lib/api/uploads"
import { queryDataset, generateDatasetReport } from "@/lib/api/rex"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { qk } from "@/lib/query-keys"
import type { RexRawTable } from "@/lib/types/agents"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataPoint { date: string; value: number }

interface ColumnMapping {
  dateColumn: string
  valueColumns: Array<{ column: string; metricKey: string }>
}

interface ParseResult {
  candidate_mapping: ColumnMapping
  sample_rows: Record<string, string>[]
  headers: string[]
  datasets: Array<{ metricKey: string; points: DataPoint[] }>
  warnings?: string[]
  saved_mapping?: ColumnMapping | null
  rawTable?: RexRawTable
}

export interface RexDataset {
  id: string
  organizationId: string
  name: string
  metricKey: string
  unit: string | null
  period: string
  points: DataPoint[]
  createdAt: string
  updatedAt: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

const rexSurfaceCls =
  "rounded-[var(--vq-r-sm)] border border-border/60 bg-background/65"
const rexLabelCls = "text-xs font-semibold text-foreground"
const rexTextCls = "text-sm leading-relaxed text-muted-foreground"
const rexMiniButtonCls =
  "inline-flex items-center gap-1.5 rounded-[var(--vq-r-sm)] border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"

const fetchDatasets = () =>
  apiFetch<RexDataset[]>("/agents/rex/datasets")

const parseDataset = (r2Key: string) =>
  apiFetch<ParseResult>("/agents/rex/datasets/parse", {
    method: "POST",
    body: { r2Key },
  })

const saveDatasets = (
  datasets: Array<{
    name: string
    metricKey: string
    period: string
    points: DataPoint[]
    purpose?: "actual" | "budget"
  }>,
  mapping?: ColumnMapping,
  rawTable?: RexRawTable,
) =>
  apiFetch<RexDataset[]>("/agents/rex/datasets", {
    method: "POST",
    body: { datasets, mapping, rawTable },
  })

const deleteDataset = (id: string) =>
  apiFetch<void>(`/agents/rex/datasets/${id}`, { method: "DELETE" })

// ── Main component ────────────────────────────────────────────────────────────

export function RexDataTab({
  organizationId,
  onOpenAction,
  onSwitchToChat,
}: {
  organizationId: string
  onOpenAction?: (actionId: string, prefill?: Record<string, unknown>) => void
  onSwitchToChat?: () => void
}) {
  const qc = useQueryClient()
  const [dragOver, setDragOver] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null)
  const [editableDatasets, setEditableDatasets] = React.useState<Array<{
    metricKey: string; name: string; period: string; points: DataPoint[]; purpose: "actual" | "budget"
  }>>([])
  const [saving, setSaving] = React.useState(false)
  const [savedRecords, setSavedRecords] = React.useState<RexDataset[] | null>(null)
  const [savedRawTable, setSavedRawTable] = React.useState<RexRawTable | null>(null)
  const [quickQuery, setQuickQuery] = React.useState("")
  const [queryingDatasetId, setQueryingDatasetId] = React.useState<string | null>(null)
  const [generatingReportId, setGeneratingReportId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<RexDataset | null>(null)

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: qk.rexDatasets(organizationId),
    queryFn: fetchDatasets,
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
  })

  const invalidateAllDatasetKeys = () => {
    // Invalidate all dataset-related query keys across components (picker, magic, strip, data-tab)
    void qc.invalidateQueries({ queryKey: ["rex", "datasets"] })
    void qc.invalidateQueries({ queryKey: ["rex", "snapshot"] })
  }

  const deleteMut = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      invalidateAllDatasetKeys()
      setDeleteTarget(null)
    },
  })

  const handleFile = async (file: File) => {
    setUploadError(null)
    setParseResult(null)
    setUploading(true)
    try {
      const r2 = await uploadToR2("rex-dataset", file)
      if (!r2.ok) { setUploadError(r2.message); return }
      const result = await parseDataset(r2.key)
      setParseResult(result)
      setEditableDatasets(
        result.datasets.map((d) => ({
          metricKey: d.metricKey,
          // For the single "table" fallback dataset, use a friendlier name
          name: d.metricKey === "table"
            ? `Dataset — ${new Date().toLocaleDateString()}`
            : `${d.metricKey} — ${new Date().toLocaleDateString()}`,
          period: "monthly",
          points: d.points,
          purpose: "actual" as const,
        }))
      )
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const records = await saveDatasets(
        editableDatasets,
        parseResult?.candidate_mapping,
        parseResult?.rawTable,
      )
      setSavedRecords(records)
      setSavedRawTable(parseResult?.rawTable ?? null)
      setQuickQuery("")
      setParseResult(null)
      setEditableDatasets([])
      invalidateAllDatasetKeys()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  const handleQuickQuery = async (q: string) => {
    if (!savedRecords?.length || !q.trim()) return
    const primaryDataset = savedRecords[0]!
    setQueryingDatasetId(primaryDataset.id)
    try {
      await queryDataset(primaryDataset.id, { query: q })
      // Invalidate chat history so the new message is visible immediately on switch
      void qc.invalidateQueries({ queryKey: ["chat", "rex"] })
      onSwitchToChat?.()
    } catch {
      // silently fail — user can retry
    } finally {
      setQueryingDatasetId(null)
      setQuickQuery("")
    }
  }

  const handleGenerateReport = async (datasetId: string) => {
    setGeneratingReportId(datasetId)
    try {
      const res = await generateDatasetReport(datasetId, "docx")
      const bytes = Uint8Array.from(atob(res.file_b64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: res.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // apiFetch already surfaces a toast on error
    } finally {
      setGeneratingReportId(null)
    }
  }

  const updateEditable = (i: number, patch: Partial<(typeof editableDatasets)[0]>) => {
    setEditableDatasets((prev) => prev.map((d, j) => j === i ? { ...d, ...patch } : d))
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-[var(--vq-r)] border border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border/70 bg-background/65",
        )}
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {uploading ? "Uploading…" : "Drop a CSV or Excel file here"}
        </p>
        <p className="text-xs text-muted-foreground">or</p>
        <label className="cursor-pointer">
          <span className={rexMiniButtonCls}>
            Browse file
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          CSV or Excel · max 10 MB 
        </p>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 rounded-[var(--vq-r-sm)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Smart post-save section */}
      {savedRecords && savedRecords.length > 0 && !parseResult && (
        <div className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-chart-2/30 bg-[color-mix(in_srgb,var(--chart-2)_8%,var(--card))] p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-chart-2" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Saved {savedRecords.length} dataset{savedRecords.length > 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {savedRecords.map((d) => d.name).join(", ")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSavedRecords(null); setSavedRawTable(null); setQuickQuery("") }}
              className="shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Dismiss
            </button>
          </div>

          {/* Column type legend */}
          {savedRawTable && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">Detected:</span>
              {Object.entries(savedRawTable.columnTypes).map(([col, type]) => (
                <span
                  key={col}
                  className={cn(
                    "rounded-[var(--vq-r-sm)] border px-2 py-1 text-xs font-medium",
                    type === "date" && "border-blue-200 bg-blue-50 text-blue-700",
                    type === "numeric" && "border-green-200 bg-green-50 text-green-700",
                    type === "categorical" && "border-purple-200 bg-purple-50 text-purple-700",
                    type === "text" && "border-border bg-background/65 text-muted-foreground",
                  )}
                >
                  {col} <span className="opacity-60">({type})</span>
                </span>
              ))}
            </div>
          )}

          {/* Ask REX section */}
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MessageSquare className="size-3" /> Ask REX about this data
            </p>

            {/* Smart suggestion chips */}
            {(() => {
              const ct = savedRawTable?.columnTypes ?? {}
              const hasDate = Object.values(ct).includes("date")
              const hasNumeric = Object.values(ct).includes("numeric")
              const hasCat = Object.values(ct).includes("categorical")
              const numCols = Object.entries(ct).filter(([, t]) => t === "numeric").map(([k]) => k)
              const catCols = Object.entries(ct).filter(([, t]) => t === "categorical").map(([k]) => k)
              const suggestions: string[] = ["Summarize this dataset"]
              if (hasDate && hasNumeric) suggestions.push("What are the trends over time?")
              if (hasNumeric) suggestions.push(`Show me a ${hasDate ? "line" : "bar"} chart`)
              if (hasCat && hasNumeric) suggestions.push(`Which ${catCols[0] ?? "category"} has the highest ${numCols[0] ?? "value"}?`)
              if (numCols.length >= 2) suggestions.push(`Compare ${numCols[0]} vs ${numCols[1]}`)
              suggestions.push("Find anomalies or outliers")
              return (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 5).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setQuickQuery(s); void handleQuickQuery(s) }}
                      disabled={!!queryingDatasetId}
                      className={cn(
                        "rounded-[var(--vq-r-sm)] border border-dashed border-chart-2/60 bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--chart-2)_10%,var(--card))] disabled:opacity-50",
                        quickQuery === s && "border-solid border-chart-2 bg-[color-mix(in_srgb,var(--chart-2)_10%,var(--card))] font-medium"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* Custom query input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && quickQuery.trim()) void handleQuickQuery(quickQuery) }}
                placeholder="Ask anything… e.g. 'Show me a bar chart of sales by region'"
                className="flex-1 rounded-[var(--vq-r-sm)] border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
              <button
                type="button"
                onClick={() => void handleQuickQuery(quickQuery)}
                disabled={!quickQuery.trim() || !!queryingDatasetId}
                className={rexMiniButtonCls}
              >
                {queryingDatasetId ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Ask
              </button>
            </div>
          </div>

          {/* Financial-specific actions — only shown when relevant metric keys match */}
          {onOpenAction && (() => {
            const hasFinancialMetric = savedRecords.some((d) => ["mrr", "revenue", "arr", "burn", "cash"].includes(d.metricKey))
            const hasForecastable = savedRecords.some((d) => ["mrr", "revenue", "arr"].includes(d.metricKey) && (d.points as DataPoint[]).length >= 3)
            if (!hasFinancialMetric) return null
            return (
              <div className="flex flex-wrap gap-2 border-t border-chart-2/20 pt-2.5">
                <p className="w-full text-xs font-semibold text-muted-foreground">Financial tools</p>
                {hasForecastable && (
                  <button
                    type="button"
                    onClick={() => {
                      const ds = savedRecords.find((d) => ["mrr", "revenue", "arr"].includes(d.metricKey))
                      onOpenAction("rex:forecast", ds ? { metric_name: ds.metricKey, historical_data: ds.points, horizon_days: 90 } : undefined)
                    }}
                    className={rexMiniButtonCls}
                  >
                    <TrendingUp className="size-3" /> Forecast 90 days
                  </button>
                )}
                {savedRecords.some((d) => (d.points as DataPoint[]).length > 0) && (
                  <button
                    type="button"
                    onClick={() => onOpenAction("rex:analyze-metrics")}
                    className={rexMiniButtonCls}
                  >
                    <LineChart className="size-3" /> Analyze metrics
                  </button>
                )}
                {savedRecords.some((d) => ["mrr", "revenue"].includes(d.metricKey)) && (
                  <button
                    type="button"
                    onClick={() => onOpenAction("rex:financial-analysis")}
                    className={rexMiniButtonCls}
                  >
                    <DollarSign className="size-3" /> Financial analysis
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Inferred mapping confirmation */}
      {parseResult && editableDatasets.length > 0 && (
        <div className={cn("flex flex-col gap-3 p-3", rexSurfaceCls)}>
          <p className={rexLabelCls}>
            Review inferred datasets
          </p>
          <p className={rexTextCls}>
            {editableDatasets.length === 1 && editableDatasets[0]?.metricKey === "table"
              ? `REX detected ${parseResult.headers.length} columns — saving as a unified table for Q&A, analysis, and reports.`
              : `REX detected ${editableDatasets.length} metric column${editableDatasets.length > 1 ? "s" : ""} from ${parseResult.headers.length} header${parseResult.headers.length !== 1 ? "s" : ""}. Adjust names and period before saving.`
            }
          </p>
          {parseResult.saved_mapping && parseResult.saved_mapping.valueColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Saved mapping found from prior upload — applied automatically.
            </p>
          )}
          {editableDatasets.map((d, i) => {
            const isTable = d.metricKey === "table" || d.points.length === 0
            return (
              <div key={i} className={cn("flex flex-col gap-2 p-2.5", rexSurfaceCls)}>
                <div className={isTable ? "w-full" : "grid grid-cols-2 gap-2"}>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Name</p>
                    <Input
                      value={d.name}
                      onChange={(e) => updateEditable(i, { name: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  {!isTable && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Period</p>
                      <select
                        value={d.period}
                        onChange={(e) => updateEditable(i, { period: e.target.value })}
                        className="h-8 w-full rounded-[var(--vq-r-sm)] border border-border bg-background px-2 text-xs"
                      >
                        {["daily", "weekly", "monthly", "quarterly"].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {isTable ? (
                    <span className="text-blue-600">
                      {`General table · ${parseResult?.rawTable?.headers.length ?? 0} columns · ${parseResult?.rawTable?.rows.length ?? 0} rows · Ask REX anything, query, analyze, or generate a report`}
                    </span>
                  ) : (
                    <>
                      <span className="font-medium">{d.metricKey}</span>
                      <span>·</span>
                      <span>{d.points.length} data points</span>
                      <span>·</span>
                      <span>{d.points[0]!.date} → {d.points[d.points.length - 1]?.date}</span>
                    </>
                  )}
                </div>
                {!isTable && (
                  <div className="flex gap-1.5">
                    {(["actual", "budget"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateEditable(i, { purpose: p })}
                        className={cn(
                          "rounded-[var(--vq-r-sm)] border border-border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                          d.purpose === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground">
                      Tag as &ldquo;budget&rdquo; to enable variance analysis.
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
              Save {editableDatasets.length} dataset{editableDatasets.length > 1 ? "s" : ""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setParseResult(null); setEditableDatasets([]) }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Saved datasets list */}
      <div className="flex flex-col gap-2">
        <p className={rexLabelCls}>
          Saved datasets ({datasets.length})
        </p>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : datasets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No datasets yet. Upload a CSV to get started.
          </p>
        ) : (
          datasets.map((ds) => {
            const meta = (ds as RexDataset & { meta?: { rawTable?: RexRawTable } | null }).meta
            const rowCount = meta?.rawTable?.rows?.length ?? (ds.points as DataPoint[]).length
            const hasTimeSeries = (ds.points as DataPoint[]).length > 0
            return (
              <div
                key={ds.id}
                className={cn("flex items-center gap-2 px-3 py-2", rexSurfaceCls)}
              >
                <BarChart2 className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{ds.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ds.metricKey} · {rowCount} {hasTimeSeries ? "pts" : "rows"} · {ds.period}
                  </p>
                </div>
                <button
                  type="button"
                  title="Ask REX about this dataset"
                  onClick={() => {
                    setSavedRecords([ds])
                    setSavedRawTable(meta?.rawTable ?? null)
                    setQuickQuery("")
                  }}
                  className={rexMiniButtonCls}
                >
                  <MessageSquare className="size-2.5" /> Ask
                </button>
                <button
                  type="button"
                  title="Generate DOCX report"
                  onClick={() => void handleGenerateReport(ds.id)}
                  disabled={generatingReportId === ds.id}
                  className={rexMiniButtonCls}
                >
                  {generatingReportId === ds.id
                    ? <Loader2 className="size-2.5 animate-spin" />
                    : <FileDown className="size-2.5" />}
                  Report
                </button>
                <button
                  type="button"
                  aria-label="Delete dataset"
                  onClick={() => setDeleteTarget(ds)}
                  disabled={deleteMut.isPending}
                  className="rounded p-1 hover:bg-destructive/10"
                >
                  <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the dataset and its saved data. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete dataset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
