"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Plug,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CustomizeSignalsDialog } from "@/components/dashboard/CustomizeSignalsDialog"
import {
  useCommandCenter,
  useRefreshCommandCenter,
  type OrgSignal,
  type WidgetRow,
} from "@/lib/api/mcp"

/**
 * The first thing on the dashboard: the customer's own business, read live out
 * of the systems they connected — not Veqiro's activity counts.
 *
 * Tiles are either a single number or a real list (the actual unread mail, the
 * actual meetings) — a dashboard of nothing but counts tells a founder almost
 * nothing they can act on. Lists are long, so every tile folds to a one-line
 * header that still shows its value, and that choice is remembered per tile.
 *
 * Leads with what needs them (staged actions awaiting approval), because the
 * only thing that earns a daily open is a queue with their name on it.
 */

/** "updated 14:32" — provider reads are cached briefly, so the card has to say
 *  how current it is rather than implying everything is live to the second. */
function formatUpdatedAt(iso: string | undefined): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const COLLAPSED_STORAGE_KEY = "veqiro.commandCenter.collapsed"

function useCollapsedTiles() {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

  // Read once on mount rather than during render — localStorage is unavailable
  // during SSR, and touching it in a render would break hydration.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY)
      if (stored) setCollapsed(new Set(JSON.parse(stored) as string[]))
    } catch {
      // A corrupt or blocked store just means nothing starts collapsed.
    }
  }, [])

  const toggle = React.useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Persisting is a nicety; the toggle still works for this session.
      }
      return next
    })
  }, [])

  return { collapsed, toggle }
}

/** Provider dates arrive as ISO strings; show something a person reads. */
function formatMeta(meta: string): string {
  const parsed = Date.parse(meta)
  if (Number.isNaN(parsed)) return meta
  const date = new Date(parsed)
  const sameDay = new Date().toDateString() === date.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function RowBody({ row }: { row: WidgetRow }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-snug text-foreground">{row.title}</span>
        {row.subtitle && (
          <span className="block truncate text-[11px] text-muted-foreground">{row.subtitle}</span>
        )}
      </span>
      {row.meta && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatMeta(row.meta)}
        </span>
      )}
      {row.link && (
        <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </>
  )
}

function RowLine({ row }: { row: WidgetRow }) {
  if (!row.link) {
    return (
      <li className="flex items-center gap-2 py-1">
        <RowBody row={row} />
      </li>
    )
  }
  return (
    <li>
      <a
        href={row.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded py-1 hover:bg-muted/60"
      >
        <RowBody row={row} />
      </a>
    </li>
  )
}

function SignalTile({
  signal,
  collapsed,
  onToggle,
}: {
  signal: OrgSignal
  collapsed: boolean
  onToggle: () => void
}) {
  const isList = signal.kind === "list"
  const rowCount = signal.rows?.length ?? 0

  return (
    <div
      className={`flex flex-col rounded-lg border-2 bg-background ${
        signal.error ? "border-foreground/30" : "border-foreground"
      } ${
        // A list needs the room when open; collapsed it is just a header, and a
        // number reads fine in a half-width tile either way.
        isList && !collapsed ? "sm:col-span-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {signal.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party logo hosts we don't control
          <img
            src={signal.logoUrl}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0 rounded object-contain"
          />
        ) : (
          <Plug className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {signal.title}
        </span>

        {/* Collapsed tiles still carry their value, so folding one away never
            costs the customer the number they came for. */}
        {collapsed && (
          <span
            className={`shrink-0 font-display text-[15px] leading-none tracking-tight tabular-nums ${
              signal.error ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {signal.error ? "!" : isList ? (rowCount > 0 ? rowCount : "—") : (signal.display ?? "—")}
          </span>
        )}
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
            collapsed ? "" : "rotate-180"
          }`}
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <div className="px-3 pb-2.5">
          {signal.error ? (
            // A tile that cannot be read says so. It used to vanish, which made
            // the dashboard look like it had failed to load rather than like
            // one system was having a bad day.
            <p className="text-[13px] text-muted-foreground">
              Couldn&apos;t read this right now.
            </p>
          ) : isList ? (
            rowCount === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nothing right now.</p>
            ) : (
              // Up to 20 rows scroll within the tile, so one long list cannot
              // push everything else off-screen.
              <ul className="flex max-h-72 flex-col divide-y divide-foreground/10 overflow-y-auto">
                {signal.rows!.map((row, i) => (
                  <RowLine key={`${row.title}-${i}`} row={row} />
                ))}
              </ul>
            )
          ) : (
            <div className="font-display text-[26px] leading-none tracking-tight tabular-nums text-foreground">
              {signal.display ?? "—"}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-foreground/30 px-4 py-5">
      <p className="max-w-prose text-sm text-muted-foreground">
        Connect a system and your agents start seeing your business here — inbox, calendar,
        revenue, whatever you plug in.
      </p>
      <Button asChild variant="brand-ghost" size="brand-sm">
        <Link href="/settings/integrations">connect your first system →</Link>
      </Button>
    </div>
  )
}

export function CommandCenter() {
  const { data, isLoading } = useCommandCenter()
  const refresh = useRefreshCommandCenter()
  const [customizing, setCustomizing] = React.useState(false)
  const { collapsed, toggle } = useCollapsedTiles()

  const signals = data?.signals ?? []
  const pending = data?.pendingActionCount ?? 0
  const hasConnections = (data?.connectedCount ?? 0) > 0
  const updatedAt = formatUpdatedAt(data?.refreshedAt)

  return (
    <div className="rounded-2xl border-[3px] border-foreground bg-card p-5 shadow-[6px_6px_0_var(--foreground)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            [ your business ]
          </div>
          <div className="mt-0.5 mb-4 font-display text-[26px] tracking-tight text-foreground">
            right now
          </div>
        </div>
        {hasConnections && (
          <div className="flex shrink-0 items-center gap-1.5">
            {updatedAt && (
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground tabular-nums">
                {refresh.isPending ? "updating…" : `updated ${updatedAt}`}
              </span>
            )}
            <Button
              variant="brand-ghost"
              size="brand-sm"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              aria-label="Refresh now"
            >
              <RefreshCw className={`size-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="brand-ghost"
              size="brand-sm"
              onClick={() => setCustomizing(true)}
              aria-label="Choose what your dashboard shows"
            >
              <SlidersHorizontal className="size-3.5" />
              customize
            </Button>
          </div>
        )}
      </div>

      <CustomizeSignalsDialog open={customizing} onOpenChange={setCustomizing} />

      {/* Needs-you queue first. Only rendered when non-zero — a permanent
          "0 waiting" tile trains people to stop looking at this spot. */}
      {pending > 0 && (
        <Link
          href="/agents/vega"
          className="mb-3 flex items-center gap-3 rounded-lg border-2 border-[#B98700] bg-[#FFEFC4] px-3 py-2.5 transition-transform hover:-translate-y-px"
        >
          <div
            className="font-display text-[24px] leading-none tabular-nums"
            style={{ color: "#7A5A00" }}
          >
            {pending}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "#7A5A00" }}
            >
              awaiting your approval
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {pending === 1 ? "An action is" : "Actions are"} staged and ready to run
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0" style={{ color: "#7A5A00" }} aria-hidden="true" />
        </Link>
      )}

      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[58px] animate-pulse rounded-lg border-2 border-foreground/15 bg-muted/40"
            />
          ))}
        </div>
      ) : signals.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {signals.map((signal) => (
            <SignalTile
              key={signal.key}
              signal={signal}
              collapsed={collapsed.has(signal.key)}
              onToggle={() => toggle(signal.key)}
            />
          ))}
        </div>
      ) : hasConnections ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Your systems are connected. Choose what you want to see from them.
          </p>
          <Button variant="brand-ghost" size="brand-sm" onClick={() => setCustomizing(true)}>
            build your dashboard →
          </Button>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
