"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Globe,
  LayoutGrid,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Settings2,
  Share2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import {
  isLiveSource,
  useDashboard,
  useDeleteWidget,
  useDuplicateWidget,
  usePromptEdit,
  useRefreshDashboard,
  useSaveLayout,
  useUpdateDashboard,
  useUpdateWidget,
  type Dashboard,
  type FilterState,
  type GridPos,
} from "@/lib/api/rexDashboards"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { DashboardCanvas } from "./DashboardCanvas"
import { FilterBar } from "./FilterBar"
import { ShareDialog } from "./ShareDialog"
import { WidgetSettingsPanel, type WidgetPatch } from "./WidgetSettingsPanel"

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never")

const PROMPT_IDEAS = [
  "Add a KPI for average order value",
  "Show revenue by month as a line chart",
  "Add a filter for region",
  "Make the top chart a pie",
]

function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function since(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return formatDistanceToNow(new Date(ms), { addSuffix: true })
}

/** Freshness, stated plainly: how long ago the numbers were last brought up to date. */
function LivePill({ dashboard, working }: { dashboard: Dashboard; working: boolean }) {
  const now = useNow()
  const live = dashboard.sources.filter(isLiveSource)
  if (live.length === 0) {
    return dashboard.refreshStatus === "running" ? (
      <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Updating…</span>
    ) : (
      <>Computed {ago(dashboard.lastRefreshedAt)}</>
    )
  }
  const failing = live.find((s) => s.syncError)
  if (failing) {
    return <StatusPill level="danger" title={failing.syncError ?? undefined} className="max-w-[28rem] truncate">{failing.syncError}</StatusPill>
  }
  if (working || dashboard.refreshStatus === "running") {
    return <StatusPill level="info" icon={<Loader2 className="animate-spin" />}>Updating from HubSpot</StatusPill>
  }
  const last = Math.max(0, ...live.map((s) => (s.lastSyncedAt ? new Date(s.lastSyncedAt).getTime() : 0)))
  return (
    <StatusPill level="ok" icon={<span className="size-1.5 animate-pulse rounded-full bg-[#1DBC87]" />}>
      Live, updated {last ? since(last, now) : "never"}
    </StatusPill>
  )
}

function SourceStatus({ dashboard }: { dashboard: Dashboard }) {
  const linked = dashboard.sources.filter((s) => s.sourceKind === "link")
  const broken = dashboard.sources.filter((s) => s.syncError)
  if (broken.length) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <div>
          {broken.map((s) => (
            <p key={s.id}>
              <span className="font-medium">{s.name}</span> couldn&apos;t be updated ({ago(s.lastSyncedAt)} was the last good
              copy): {s.syncError}
            </p>
          ))}
          <p className="mt-1 text-muted-foreground">The dashboard keeps showing the last good data until this is fixed.</p>
        </div>
      </div>
    )
  }
  if (!linked.length) return null
  const last = linked.map((s) => s.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Link2 className="size-3" /> Live from {linked.length === 1 ? linked[0]!.name : `${linked.length} linked sheets`} · checked {ago(last)}
    </span>
  )
}

export function DashboardEditor({ dashboardId, backLink }: { dashboardId: string; backLink?: React.ReactNode }) {
  const [filterState, setFilterState] = React.useState<FilterState>({})
  // After a Refresh that HubSpot was too slow for, check back quickly for a minute.
  const [fast, setFast] = React.useState(false)
  React.useEffect(() => {
    if (!fast) return
    const t = setTimeout(() => setFast(false), 60_000)
    return () => clearTimeout(t)
  }, [fast])
  const { data, isLoading, error, isFetching } = useDashboard(dashboardId, filterState, { fast })
  const qc = useQueryClient()

  const [editing, setEditing] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [prompt, setPrompt] = React.useState("")
  const [title, setTitle] = React.useState("")

  const promptEdit = usePromptEdit(dashboardId)
  const refresh = useRefreshDashboard(dashboardId)
  const updateWidget = useUpdateWidget(dashboardId)
  const deleteWidget = useDeleteWidget(dashboardId)
  const duplicateWidget = useDuplicateWidget(dashboardId)
  const updateDashboard = useUpdateDashboard(dashboardId)
  const saveLayout = useSaveLayout(dashboardId)

  React.useEffect(() => {
    if (data?.title) setTitle(data.title)
  }, [data?.title])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[var(--vq-r)]" />)}
        </div>
        <Skeleton className="h-72 rounded-[var(--vq-r)]" />
      </div>
    )
  }
  if (error || !data) {
    return <EmptyState title="Dashboard not found" description="It may have been deleted." />
  }

  const widget = data.widgets.find((w) => w.id === selected) ?? null
  const hasLive = data.sources.some(isLiveSource)

  const runRefresh = (full: boolean) =>
    refresh.mutate({ full }, {
      onSuccess: (out) => {
        if (out.sync?.some((r) => r.status === "timeout")) {
          toast.info("HubSpot is still syncing. This page updates when it finishes.")
          setFast(true)
          return
        }
        const failed = out.sync?.find((r) => r.status === "error")
        if (failed) toast.warning(failed.message ?? "HubSpot couldn't be reached. Showing the last data.")
        else toast.success(full ? "Fully resynced" : "Up to date")
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Refresh failed"),
    })

  const runPrompt = (text: string, widgetId?: string) => {
    if (!text.trim() || promptEdit.isPending) return
    const t = toast.loading("Rex is updating the dashboard…")
    promptEdit.mutate(
      { prompt: text.trim(), widgetId },
      {
        onSuccess: (d) => {
          setPrompt("")
          toast.success("Dashboard updated", { id: t })
          for (const drop of d.dropped ?? []) toast.warning(`Skipped "${drop.title}" — ${drop.error}`)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update the dashboard", { id: t }),
      },
    )
  }

  const commitLayout = (items: Array<GridPos & { id: string }>) => {
    // Show the new arrangement immediately; persist behind it.
    qc.setQueriesData<Dashboard>({ queryKey: ["rex", "dashboard", dashboardId] }, (d) =>
      d ? { ...d, widgets: d.widgets.map((w) => {
        const it = items.find((i) => i.id === w.id)
        return it ? { ...w, layout: { x: it.x, y: it.y, w: it.w, h: it.h } } : w
      }) } : d)
    saveLayout.mutate(items, { onError: () => toast.error("Couldn't save the layout") })
  }

  const saveTitle = () => {
    const next = title.trim()
    if (next && next !== data.title) updateDashboard.mutate({ title: next })
    else setTitle(data.title)
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {backLink}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-input focus-visible:px-2 dark:bg-transparent"
            aria-label="Dashboard title"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span><LivePill dashboard={data} working={refresh.isPending || fast} /></span>
            {data.isPublic && (
              <span className="inline-flex items-center gap-1 text-[#1DBC87]"><Globe className="size-3" /> Public</span>
            )}
            <SourceStatus dashboard={data} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => { setEditing((e) => !e); setSelected(null) }}>
            {editing ? <><Check className="size-3.5" /> Done</> : <><LayoutGrid className="size-3.5" /> Edit layout</>}
          </Button>
          <div className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              className={hasLive ? "rounded-r-none" : undefined}
              disabled={refresh.isPending || data.refreshStatus === "running"}
              onClick={() => runRefresh(false)}
            >
              <RefreshCw className={cn("size-3.5", refresh.isPending && "animate-spin")} />
              {refresh.isPending ? (hasLive ? "Syncing HubSpot" : "Refreshing") : "Refresh"}
            </Button>
            {hasLive && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" className="h-7 rounded-l-none border-l-0" aria-label="More refresh options" disabled={refresh.isPending} />}>
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => runRefresh(true)}>Full resync from HubSpot</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="size-3.5" /> Share
          </Button>
        </div>
      </div>

      {data.sources.some((s) => s.syncError) && <SourceStatus dashboard={data} />}
      {data.refreshStatus === "error" && data.refreshError && (
        <p className="text-xs text-destructive">Last refresh failed: {data.refreshError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterBar filters={data.filters} state={filterState} onChange={setFilterState} />
        {isFetching && Object.keys(filterState).length > 0 && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      {editing && (
        <p className="text-xs text-muted-foreground">
          Drag tiles by their handle, resize from the corner, or click a tile to change its chart, columns and colors.
        </p>
      )}

      {data.widgets.length === 0 ? (
        <EmptyState title="No tiles yet" description="Ask Rex below to add some." />
      ) : (
        <DashboardCanvas
          widgets={data.widgets}
          results={data.results}
          editable={editing}
          selectedId={selected}
          onSelect={setSelected}
          onLayoutCommit={commitLayout}
          tileActions={(w) => !editing && (
            <button
              type="button"
              className="text-muted-foreground/60 hover:text-foreground"
              aria-label={`Settings for ${w.title}`}
              onClick={(e) => { e.stopPropagation(); setSelected(w.id) }}
            >
              <Settings2 className="size-3.5" />
            </button>
          )}
        />
      )}

      <WidgetSettingsPanel
        widget={widget}
        result={widget ? data.results[widget.id] : undefined}
        filters={data.filters}
        open={!!widget}
        onOpenChange={(o) => !o && setSelected(null)}
        saving={updateWidget.isPending}
        onSave={(patch: WidgetPatch) => updateWidget.mutateAsync({ widgetId: widget!.id, ...patch })}
        onDelete={() => {
          const id = widget!.id
          setSelected(null)
          deleteWidget.mutate(id, { onError: () => toast.error("Couldn't delete the tile") })
        }}
        onDuplicate={() => {
          const id = widget!.id
          setSelected(null)
          duplicateWidget.mutate(id, { onError: () => toast.error("Couldn't duplicate the tile") })
        }}
        onAskRex={(text) => runPrompt(text, widget!.id)}
      />

      <ShareDialog dashboard={data} open={shareOpen} onOpenChange={setShareOpen} />

      {/* The prompt bar: the fastest way to change anything. */}
      <div className="sticky bottom-3 z-10 mt-2">
        <form
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border vq-material-thick p-1.5 pl-4"
          onSubmit={(e) => { e.preventDefault(); runPrompt(prompt) }}
        >
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PROMPT_IDEAS[data.widgets.length % PROMPT_IDEAS.length]}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={promptEdit.isPending}
            aria-label="Ask Rex to change the dashboard"
          />
          <Button type="submit" size="icon-sm" className="rounded-full" disabled={!prompt.trim() || promptEdit.isPending} aria-label="Send">
            {promptEdit.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
