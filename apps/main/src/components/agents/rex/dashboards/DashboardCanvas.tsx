"use client"

import * as React from "react"
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import { ChartColumn, GripVertical, Table2 } from "lucide-react"

import type { DashboardWidget, GridPos, WidgetResult } from "@/lib/api/rexDashboards"
import { cn } from "@/lib/utils"
import { WidgetBody, hasTableTwin, widgetInsight } from "./WidgetView"

const ROW_HEIGHT = 56
const MARGIN: [number, number] = [12, 12]
/** Below this the grid would squash tiles; stack them in one column instead. */
const STACK_BELOW = 640

interface Props {
  widgets: DashboardWidget[]
  results: Record<string, WidgetResult>
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onLayoutCommit?: (items: Array<GridPos & { id: string }>) => void
  /** Rendered in each tile's header, right side (the editor's menu). */
  tileActions?: (w: DashboardWidget) => React.ReactNode
}

function Tile({
  widget, result, editable, selected, onSelect, actions, index = 0,
}: {
  index?: number
  widget: DashboardWidget
  result?: WidgetResult
  editable?: boolean
  selected?: boolean
  onSelect?: () => void
  actions?: React.ReactNode
}) {
  // Every chart has a table twin: the accessible equivalent, and the relief for palette slots
  // that sit under 3:1 on the light surface.
  const [asTable, setAsTable] = React.useState(false)
  const insight = React.useMemo(() => widgetInsight(widget, result), [widget, result])
  const twin = hasTableTwin(widget) && !!result?.rows.length
  return (
    <div
      onClick={editable ? onSelect : undefined}
      // Mount-only stagger (keys are widget ids, so a data refresh never replays it).
      style={{ ["--vq-stagger-i" as string]: Math.min(index, 12) }}
      className={cn(
        "vq-stagger-item flex h-full flex-col overflow-hidden rounded-[var(--vq-r)] border bg-card p-3.5 shadow-[var(--vq-shadow-sm)] transition-shadow duration-(--vq-dur) ease-out-quint hover:shadow-[var(--vq-shadow)]",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        editable && "cursor-pointer",
      )}
    >
      <div className="mb-2 flex min-w-0 items-center gap-1">
        {editable && (
          <span className="rex-drag -ml-1 cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing" aria-label="Drag">
            <GripVertical className="size-3.5" />
          </span>
        )}
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.005em] text-foreground" title={widget.title}>
          {widget.title}
        </h3>
        {twin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAsTable((t) => !t)
            }}
            className="grid size-6 shrink-0 place-items-center rounded-[var(--vq-r-sm)] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            aria-label={asTable ? "Show as chart" : "Show as table"}
            aria-pressed={asTable}
            title={asTable ? "Show as chart" : "Show as table"}
          >
            {asTable ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
          </button>
        )}
        {actions}
      </div>
      <div className="min-h-0 flex-1">
        <WidgetBody widget={widget} result={result} asTable={asTable} />
      </div>
      {insight && !asTable && (
        <p className="mt-1.5 truncate text-[11px] leading-tight text-muted-foreground" title={insight}>
          {insight}
        </p>
      )}
    </div>
  )
}

/** Stable reading order for the one-column phone view: top to bottom, then left to right. */
const readingOrder = (a: DashboardWidget, b: DashboardWidget) =>
  a.layout.y - b.layout.y || a.layout.x - b.layout.x

export function DashboardCanvas({ widgets, results, editable, selectedId, onSelect, onLayoutCommit, tileActions }: Props) {
  const { width, containerRef, mounted } = useContainerWidth()
  const layout: Layout = React.useMemo(
    () => widgets.map((w) => ({
      i: w.id, ...w.layout,
      minW: w.kind === "kpi" ? 2 : 3, minH: w.kind === "kpi" ? 2 : 3,
    })),
    [widgets],
  )

  const commit = React.useCallback((next: Layout) => {
    if (!onLayoutCommit) return
    const changed = next.filter((item) => {
      const w = widgets.find((x) => x.id === item.i)
      return w && (w.layout.x !== item.x || w.layout.y !== item.y || w.layout.w !== item.w || w.layout.h !== item.h)
    })
    if (changed.length) {
      onLayoutCommit(next.map((i) => ({ id: i.i, x: i.x, y: i.y, w: i.w, h: i.h })))
    }
  }, [onLayoutCommit, widgets])

  const stacked = mounted && width < STACK_BELOW

  return (
    <div ref={containerRef} className="w-full">
      {mounted && stacked && (
        <div className="flex flex-col gap-3">
          {[...widgets].sort(readingOrder).map((w, i) => (
            <div key={w.id} style={{ height: w.kind === "kpi" ? 132 : w.kind === "table" ? 320 : 280 }}>
              <Tile index={i} widget={w} result={results[w.id]} editable={editable} selected={selectedId === w.id}
                onSelect={() => onSelect?.(w.id)} actions={tileActions?.(w)} />
            </div>
          ))}
        </div>
      )}
      {mounted && !stacked && (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 12, rowHeight: ROW_HEIGHT, margin: MARGIN, containerPadding: [0, 0] }}
          dragConfig={{ enabled: !!editable, handle: ".rex-drag" }}
          resizeConfig={{ enabled: !!editable, handles: ["se"] }}
          onDragStop={(next) => commit(next)}
          onResizeStop={(next) => commit(next)}
        >
          {[...widgets].sort(readingOrder).map((w, i) => (
            <div key={w.id}>
              <Tile index={i} widget={w} result={results[w.id]} editable={editable} selected={selectedId === w.id}
                onSelect={() => onSelect?.(w.id)} actions={tileActions?.(w)} />
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  )
}
