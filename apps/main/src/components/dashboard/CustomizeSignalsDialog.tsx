"use client"

import * as React from "react"
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useAddDashboardTile,
  useAvailableWidgets,
  useDashboardTiles,
  useRemoveDashboardTile,
  useWidgetPreview,
  type AvailableWidget,
  type DashboardTile,
} from "@/lib/api/mcp"

/**
 * Where a founder composes their dashboard.
 *
 * Everything here is business language — "Unread email", "Search clicks (28
 * days)" — never tool names or field paths. An earlier version exposed the
 * discovered JSON structure and was unusable for a non-technical owner, which
 * is the whole reason the widget catalog exists.
 */

function WidgetPreview({
  widget,
  inputs,
}: {
  widget: AvailableWidget
  inputs: Record<string, string>
}) {
  // Only preview once every declared input has a value — otherwise the call
  // fails and the customer sees an error they can't act on.
  const ready = widget.inputs.every((i) => inputs[i.name])
  const preview = useWidgetPreview(ready ? widget.id : null, inputs)

  if (!ready) return null
  if (preview.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Reading it now…
      </div>
    )
  }
  if (preview.data?.error) {
    return <p className="text-xs text-muted-foreground">Could not read this right now.</p>
  }
  if (preview.data?.kind === "metric") {
    return (
      <div className="font-display text-[28px] leading-none tracking-tight tabular-nums">
        {preview.data.display ?? "—"}
      </div>
    )
  }
  const rows = preview.data?.rows ?? []
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing to show right now.</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {rows.slice(0, 3).map((row, i) => (
        <li key={`${row.title}-${i}`} className="min-w-0 text-xs">
          <span className="block truncate font-medium text-foreground">{row.title}</span>
          {row.subtitle && (
            <span className="block truncate text-muted-foreground">{row.subtitle}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Same widget with different inputs is a different tile (clicks for two
 *  different sites), so "already added" compares inputs too. */
function isPinned(
  tiles: DashboardTile[],
  widget: AvailableWidget,
  inputs: Record<string, string>,
): boolean {
  return tiles.some((tile) => {
    if (tile.widgetId !== widget.id) return false
    const keys = new Set([...Object.keys(tile.inputs ?? {}), ...Object.keys(inputs)])
    return [...keys].every((key) => String(tile.inputs?.[key] ?? "") === String(inputs[key] ?? ""))
  })
}

function WidgetCard({ widget, tiles }: { widget: AvailableWidget; tiles: DashboardTile[] }) {
  const [inputs, setInputs] = React.useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {}
    for (const input of widget.inputs) {
      // A declared default (e.g. "last 28 days") wins; otherwise pre-select the
      // only option so a single-property account needs no choice at all.
      if (input.defaultValue) seeded[input.name] = input.defaultValue
      else if (input.options?.length === 1) seeded[input.name] = input.options[0]
    }
    return seeded
  })
  const [label, setLabel] = React.useState("")
  const addTile = useAddDashboardTile()

  const complete = widget.inputs.every((i) => inputs[i.name])
  const added = isPinned(tiles, widget, inputs)

  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-foreground bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{widget.name}</div>
          <div className="text-xs text-muted-foreground">{widget.description}</div>
        </div>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {widget.integrationName}
        </span>
      </div>

      {widget.inputs.map((input) => (
        <label key={input.name} className="flex flex-col gap-1">
          <span className="text-xs text-foreground">{input.label}</span>
          {input.choices && input.choices.length > 0 ? (
            // Labelled choices: the stored value is a day count, but the
            // customer only ever sees "Last 28 days".
            <select
              value={inputs[input.name] ?? ""}
              onChange={(e) => setInputs((v) => ({ ...v, [input.name]: e.target.value }))}
              className="h-8 rounded-md border-2 border-foreground bg-background px-2 text-sm"
            >
              {input.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          ) : input.options && input.options.length > 0 ? (
            <select
              value={inputs[input.name] ?? ""}
              onChange={(e) => setInputs((v) => ({ ...v, [input.name]: e.target.value }))}
              className="h-8 rounded-md border-2 border-foreground bg-background px-2 text-sm"
            >
              <option value="">Choose…</option>
              {input.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={inputs[input.name] ?? ""}
              placeholder={input.placeholder}
              onChange={(e) => setInputs((v) => ({ ...v, [input.name]: e.target.value }))}
              className="h-8"
            />
          )}
        </label>
      ))}

      {!added && (
        <div className="rounded-md border border-foreground/15 bg-muted/40 p-2.5">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            preview
          </div>
          <WidgetPreview widget={widget} inputs={inputs} />
        </div>
      )}

      {added ? (
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#0E5C3F]">
          <Check className="size-3.5" aria-hidden="true" />
          on your dashboard
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Call it "${widget.name}"`}
            aria-label="Rename this widget"
            className="h-8 flex-1"
          />
          <Button
            size="sm"
            disabled={!complete || addTile.isPending}
            onClick={() =>
              addTile.mutate({
                widgetId: widget.id,
                inputs,
                label: label.trim() || null,
              })
            }
          >
            {addTile.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

export function CustomizeSignalsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: tiles = [] } = useDashboardTiles()
  const { data: widgets = [], isLoading } = useAvailableWidgets(open)
  const removeTile = useRemoveDashboardTile()
  const [search, setSearch] = React.useState("")

  // Grouped by system so the gallery reads as "what can Gmail show me?".
  // Matching the system name too means typing "gmail" finds its widgets even
  // though none of them have "Gmail" in their own name.
  const grouped = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const map = new Map<string, AvailableWidget[]>()
    for (const widget of widgets) {
      if (
        query &&
        !`${widget.name} ${widget.description} ${widget.integrationName}`
          .toLowerCase()
          .includes(query)
      ) {
        continue
      }
      const list = map.get(widget.integrationName) ?? []
      list.push(widget)
      map.set(widget.integrationName, list)
    }
    return [...map.entries()]
  }, [widgets, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Build your dashboard</DialogTitle>
          <DialogDescription>
            Pick what matters to you. Add nothing and we&apos;ll show sensible defaults.
          </DialogDescription>
        </DialogHeader>

        {tiles.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              on your dashboard
            </div>
            {tiles.map((tile) => (
              <div
                key={tile.id}
                className="flex items-center gap-2 rounded-lg border-2 border-foreground bg-background px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{tile.name}</div>
                  <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {tile.integrationName}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${tile.name}`}
                  disabled={removeTile.isPending}
                  onClick={() => removeTile.mutate(tile.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-2 border-foreground/10 pt-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search systems or metrics…"
              aria-label="Search available widgets"
              className="h-9 pl-8"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking what your systems can show…
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? `Nothing matches "${search.trim()}".`
                : "None of your connected systems have dashboard widgets yet. We add them as we verify each one against real data."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map(([system, systemWidgets]) => (
                <div key={system} className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {system}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {systemWidgets.map((widget) => (
                      <WidgetCard key={widget.id} widget={widget} tiles={tiles} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
