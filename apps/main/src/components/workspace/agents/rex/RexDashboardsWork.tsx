"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft, Globe, LayoutDashboard, Link2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"
import { useCreateDashboard, useDashboards, useDeleteDashboard } from "@/lib/api/rexDashboards"
import type { WorkDetailProps, WorkListProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { DashboardEditor } from "@/components/agents/rex/dashboards/DashboardEditor"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"

interface DatasetRow {
  id: string
  name: string
  sourceKind?: string
  syncError?: string | null
  updatedAt: string
  meta?: { rawTable?: { headers?: string[]; rows?: unknown[]; fileKey?: string; sheets?: Record<string, unknown> } } | null
}

const EXAMPLES = [
  "Sales overview: revenue, orders and average order value, with trends by month and a breakdown by region",
  "Where is our money going? Expenses by category and month, biggest vendors",
  "Customer dashboard: new customers per month, churn, and top customers by revenue",
]

/** One upload can create several dataset rows (one per metric) over the same file; offer each
 *  file once, the way Rex's chat lists them. */
function useDashboardSources(organizationId: string) {
  return useQuery({
    queryKey: qk.rexDatasets(organizationId),
    queryFn: () => apiFetch<DatasetRow[]>("/agents/rex/datasets"),
    select: (rows) => {
      const seen = new Set<string>()
      return rows.filter((r) => {
        const table = r.meta?.rawTable
        if (!table?.headers?.length) return false
        const key = table.fileKey ?? r.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    },
  })
}

function NewDashboardDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { hrefFor } = useAgentWorkspace()
  const { data: sources = [], isLoading } = useDashboardSources(organizationId)
  const create = useCreateDashboard()
  const [picked, setPicked] = React.useState<string[]>([])
  const [prompt, setPrompt] = React.useState("")

  React.useEffect(() => {
    if (open && picked.length === 0 && sources.length === 1) setPicked([sources[0]!.id])
  }, [open, sources, picked.length])

  const submit = () =>
    create.mutate(
      { prompt: prompt.trim(), datasetIds: picked },
      {
        onSuccess: (d) => {
          onOpenChange(false)
          setPrompt("")
          setPicked([])
          for (const drop of d.dropped ?? []) toast.warning(`Skipped "${drop.title}" — ${drop.error}`)
          router.push(`${hrefFor("work", "dashboards")}/${d.id}`)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't build the dashboard"),
      },
    )

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New dashboard</DialogTitle>
          <DialogDescription>Pick your data and describe what you want to see. Rex builds it; you can change anything after.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">Data</p>
          {isLoading ? (
            <Skeleton className="h-16 rounded-md" />
          ) : sources.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No spreadsheets yet. Upload one or paste a Google Sheets link under Datasets first.
            </p>
          ) : (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {sources.map((s) => {
                const rows = s.meta?.rawTable?.rows?.length ?? 0
                const sheets = Object.keys(s.meta?.rawTable?.sheets ?? {}).length
                return (
                  <label key={s.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
                    <Checkbox
                      checked={picked.includes(s.id)}
                      disabled={!picked.includes(s.id) && picked.length >= 5}
                      onCheckedChange={(v) => setPicked((p) => (v ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {s.sourceKind === "link" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#1DBC87]"><Link2 className="size-3" /> live</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {sheets > 1 ? `${sheets} sheets` : `${rows >= 500 ? "500+" : rows} rows`}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">What should it show?</p>
          <Textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Monthly revenue trend, top 10 products, sales by region, and a KPI for total orders"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border px-2.5 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {ex.split(":")[0]!.split("?")[0]}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending || picked.length === 0 || prompt.trim().length < 3}>
            {create.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Building…</> : <><Sparkles className="size-3.5" /> Build dashboard</>}
          </Button>
        </DialogFooter>
        {create.isPending && (
          <p className="text-center text-xs text-muted-foreground">Rex is reading every row and checking each chart&apos;s numbers — this takes a little while.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RexDashboardsWork({ organizationId }: WorkListProps) {
  const { hrefFor } = useAgentWorkspace()
  const { data = [], isLoading } = useDashboards()
  const remove = useDeleteDashboard()
  const [creating, setCreating] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Live dashboards built from your spreadsheets. Share any of them with a link.</p>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-3.5" /> New dashboard</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[var(--vq-r)]" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description="Pick a spreadsheet, describe what you want to track, and Rex builds a dashboard you can edit and share."
          action={{ label: "New dashboard", onClick: () => setCreating(true) }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <Link
              key={d.id}
              href={`${hrefFor("work", "dashboards")}/${d.id}`}
              className="group flex flex-col gap-2 rounded-[var(--vq-r)] border border-border bg-card p-4 no-underline transition-colors hover:border-foreground/30"
            >
              <div className="flex items-start gap-2">
                <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-medium text-foreground">{d.title}</p>
                {d.isPublic && <Globe className="size-3.5 shrink-0 text-[#1DBC87]" aria-label="Public" />}
                <button
                  type="button"
                  aria-label={`Delete ${d.title}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm(`Delete "${d.title}"? Its public link stops working.`)) remove.mutate(d.id)
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              {d.description && <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}
              <p className="mt-auto text-[11px] text-muted-foreground">
                {d._count.widgets} tiles · updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
              </p>
            </Link>
          ))}
        </div>
      )}

      <NewDashboardDialog organizationId={organizationId} open={creating} onOpenChange={setCreating} />
    </div>
  )
}

export function RexDashboardDetail({ objectId }: WorkDetailProps) {
  const { hrefFor } = useAgentWorkspace()
  return (
    <DashboardEditor
      dashboardId={objectId}
      backLink={
        <Link
          href={hrefFor("work", "dashboards")}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> All dashboards
        </Link>
      }
    />
  )
}
