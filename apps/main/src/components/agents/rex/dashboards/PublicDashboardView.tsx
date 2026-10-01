"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"

import { fetchPublicDashboard, type FilterState, type PublicDashboard } from "@/lib/api/rexDashboards"
import { DashboardCanvas } from "./DashboardCanvas"
import { FilterBar } from "./FilterBar"

/** The read-only page behind a shared link. No session; everything comes from stored results. */
export function PublicDashboardView({ token }: { token: string }) {
  const [data, setData] = React.useState<PublicDashboard | null | undefined>(undefined)
  const [state, setState] = React.useState<FilterState>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPublicDashboard(token, state)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, state])

  if (data === undefined && loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (data === null || (data === undefined && error)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-lg font-semibold">This dashboard isn&apos;t available</p>
        <p className="text-sm text-muted-foreground">The link may have been turned off by its owner.</p>
      </main>
    )
  }

  const d = data!
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
          {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
          {d.lastRefreshedAt && (
            <p className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(d.lastRefreshedAt), { addSuffix: true })}
            </p>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <FilterBar filters={d.filters} state={state} onChange={setState} />
          {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>

        <DashboardCanvas widgets={d.widgets} results={d.results} />

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Made with{" "}
          <a href="https://veqiro.com" className="font-medium text-foreground underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
            Veqiro
          </a>{" "}
          — dashboards from your spreadsheets, by prompt.
        </footer>
      </div>
    </main>
  )
}
