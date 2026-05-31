"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Upload, Trash2, BarChart2, CheckCircle, AlertCircle, Loader2, TrendingUp, LineChart, DollarSign, Sparkles } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { uploadToR2 } from "@/lib/api/uploads"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"

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
) =>
  apiFetch<RexDataset[]>("/agents/rex/datasets", {
    method: "POST",
    body: { datasets, mapping },
  })

const deleteDataset = (id: string) =>
  apiFetch<void>(`/agents/rex/datasets/${id}`, { method: "DELETE" })

export const REX_DATASETS_KEY = (orgId: string) => ["rex", "datasets", orgId]

// ── Main component ────────────────────────────────────────────────────────────

export function RexDataTab({
  organizationId,
  onOpenAction,
}: {
  organizationId: string
  onOpenAction?: (actionId: string, prefill?: Record<string, unknown>) => void
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
  const [lastSaved, setLastSaved] = React.useState<Array<{ metricKey: string; name: string; points: DataPoint[] }> | null>(null)

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: REX_DATASETS_KEY(organizationId),
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
    onSuccess: invalidateAllDatasetKeys,
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
          name: `${d.metricKey} — ${new Date().toLocaleDateString()}`,
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
      await saveDatasets(editableDatasets, parseResult?.candidate_mapping)
      setLastSaved(editableDatasets)
      setParseResult(null)
      setEditableDatasets([])
      invalidateAllDatasetKeys()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
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
          "flex flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
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
        <p className="text-[11px] text-muted-foreground">or</p>
        <label className="cursor-pointer">
          <span className="border border-border px-3 py-1.5 text-xs hover:bg-muted">
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
        <p className="text-[10px] text-muted-foreground">
          CSV or Excel · max 10 MB · first sheet only (multi-sheet xlsx)
        </p>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Post-save quick actions */}
      {lastSaved && lastSaved.length > 0 && !parseResult && onOpenAction && (
        <div
          className="flex flex-col gap-3 border-2 p-4"
          style={{ borderColor: "#1DBC87", background: "#f0fdf4" }}
        >
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 size-4 shrink-0" style={{ color: "#1DBC87" }} />
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                Saved {lastSaved.length} dataset{lastSaved.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lastSaved.map((d) => d.name).join(", ")} — ready to use
              </p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-foreground">What would you like Rex to do with this data?</p>
          <div className="flex flex-wrap gap-2">
            {lastSaved.some((d) => ["mrr", "revenue", "arr"].includes(d.metricKey)) && (
              <button
                type="button"
                onClick={() => {
                  const ds = lastSaved.find((d) => ["mrr", "revenue", "arr"].includes(d.metricKey))
                  onOpenAction("rex:forecast", ds ? { metric_name: ds.metricKey, historical_data: ds.points, horizon_days: 90 } : undefined)
                  setLastSaved(null)
                }}
                className="flex items-center gap-1.5 border-2 border-[#111] bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-[#FFF9ED]"
                style={{ boxShadow: "2px 2px 0 #111" }}
              >
                <TrendingUp className="size-3" /> Forecast 90 days
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenAction("rex:analyze-metrics")
                setLastSaved(null)
              }}
              className="flex items-center gap-1.5 border-2 border-[#111] bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-[#FFF9ED]"
              style={{ boxShadow: "2px 2px 0 #111" }}
            >
              <LineChart className="size-3" /> Analyze metrics
            </button>
            {lastSaved.some((d) => ["mrr", "revenue"].includes(d.metricKey)) && (
              <button
                type="button"
                onClick={() => {
                  onOpenAction("rex:financial-analysis")
                  setLastSaved(null)
                }}
                className="flex items-center gap-1.5 border-2 border-[#111] bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-[#FFF9ED]"
                style={{ boxShadow: "2px 2px 0 #111" }}
              >
                <DollarSign className="size-3" /> Financial analysis
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastSaved(null)}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Parse warnings (non-blocking) */}
      {parseResult && (parseResult.warnings?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1 border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="font-medium">Parser notes</span>
          </div>
          {parseResult.warnings!.map((w, i) => (
            <p key={i} className="pl-5 text-[10.5px] leading-snug">• {w}</p>
          ))}
        </div>
      )}

      {/* No-data warning when parse produced 0 datasets */}
      {parseResult && editableDatasets.length === 0 && (
        <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          REX could not extract any usable metrics. CSV needs at least one date column and one numeric column. See parser notes above.
        </div>
      )}

      {/* Inferred mapping confirmation */}
      {parseResult && editableDatasets.length > 0 && (
        <div className="flex flex-col gap-3 border border-border p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Review inferred datasets
          </p>
          <p className="text-[11px] text-muted-foreground">
            REX detected {editableDatasets.length} metric column{editableDatasets.length > 1 ? "s" : ""} from{" "}
            {parseResult.headers.length} header{parseResult.headers.length !== 1 ? "s" : ""}. Adjust names and period before saving.
          </p>
          {parseResult.saved_mapping && parseResult.saved_mapping.valueColumns.length > 0 && (
            <p className="text-[10.5px] text-muted-foreground">
              Saved mapping found from prior upload — applied automatically.
            </p>
          )}
          {editableDatasets.map((d, i) => (
            <div key={i} className="flex flex-col gap-2 border border-border bg-muted/10 p-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Name</p>
                  <Input
                    value={d.name}
                    onChange={(e) => updateEditable(i, { name: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Period</p>
                  <select
                    value={d.period}
                    onChange={(e) => updateEditable(i, { period: e.target.value })}
                    className="h-7 w-full border border-border bg-background px-2 text-xs"
                  >
                    {["daily", "weekly", "monthly", "quarterly"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-mono">{d.metricKey}</span>
                <span>·</span>
                <span>{d.points.length} data points</span>
                {d.points[0] && (
                  <>
                    <span>·</span>
                    <span>{d.points[0].date} → {d.points[d.points.length - 1]?.date}</span>
                  </>
                )}
              </div>
              <div className="flex gap-1.5">
                {(["actual", "budget"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateEditable(i, { purpose: p })}
                    className={cn(
                      "border border-border px-2 py-0.5 text-[10px] capitalize",
                      d.purpose === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground">
                  Tag as &ldquo;budget&rdquo; to enable variance analysis.
                </span>
              </div>
            </div>
          ))}
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
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Saved datasets ({datasets.length})
        </p>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : datasets.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No datasets yet. Upload a CSV to get started.
          </p>
        ) : (
          datasets.map((ds) => (
            <div
              key={ds.id}
              className="flex items-center gap-2 border border-border bg-muted/10 px-3 py-2"
            >
              <BarChart2 className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-medium">{ds.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ds.metricKey} · {(ds.points as DataPoint[]).length} pts · {ds.period}
                </p>
              </div>
              <StatusPill level="ok">{ds.metricKey}</StatusPill>
              <button
                type="button"
                aria-label="Delete dataset"
                onClick={() => deleteMut.mutate(ds.id)}
                disabled={deleteMut.isPending}
                className="ml-1 rounded p-1 hover:bg-destructive/10"
              >
                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
