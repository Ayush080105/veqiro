"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, PenLine, Eye } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useActionLog, type ActionLogFilters } from "@/lib/api/mcp"

/**
 * The record of what agents did in the customer's own systems — the answer to
 * "what has this thing been doing", which until now could only be reconstructed
 * by scrolling six chat histories.
 *
 * Shows that an action happened, never what it contained: the underlying log
 * stores no arguments and no results, deliberately, because those carry email
 * bodies and financial records.
 */
export function ActionLogCard() {
  const [filters, setFilters] = useState<ActionLogFilters>({ limit: 25 })
  const { data, isLoading, isError, error } = useActionLog(filters)

  const entries = data?.entries ?? []
  const integrations = data?.integrations ?? []

  const setFilter = (patch: Partial<ActionLogFilters>) =>
    // Cursor is per-filter-set; changing a filter must drop it or page two of
    // the old query gets applied to the new one.
    setFilters((prev) => ({ ...prev, ...patch, before: undefined }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Activity log</CardTitle>
        <CardDescription className="text-xs">
          Every action your agents took in a connected tool. Contents are never
          recorded — only that it happened.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter({ integrationSlug: undefined })}
            className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
              !filters.integrationSlug
                ? "border-foreground bg-foreground text-background"
                : "border-[#D4C9B0] hover:bg-[#EFE7D6]"
            }`}
          >
            All tools
          </button>
          {integrations.slice(0, 6).map((i) => (
            <button
              key={i.slug}
              onClick={() => setFilter({ integrationSlug: i.slug })}
              className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                filters.integrationSlug === i.slug
                  ? "border-foreground bg-foreground text-background"
                  : "border-[#D4C9B0] hover:bg-[#EFE7D6]"
              }`}
            >
              {i.name} <span className="opacity-60">{i.count}</span>
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-[#D4C9B0]" />

          <button
            onClick={() => setFilter({ writesOnly: !filters.writesOnly })}
            className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
              filters.writesOnly
                ? "border-foreground bg-foreground text-background"
                : "border-[#D4C9B0] hover:bg-[#EFE7D6]"
            }`}
          >
            Changes only
          </button>
          <button
            onClick={() => setFilter({ failuresOnly: !filters.failuresOnly })}
            className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
              filters.failuresOnly
                ? "border-foreground bg-foreground text-background"
                : "border-[#D4C9B0] hover:bg-[#EFE7D6]"
            }`}
          >
            Failures only
          </button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="text-xs text-destructive">
            Couldn&apos;t load the log: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing here yet. Actions appear once an agent uses a connected tool.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">What</th>
                  <th className="pb-2 pr-3 font-medium">Tool</th>
                  <th className="pb-2 pr-3 font-medium">Agent</th>
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 font-medium tabular-nums">Took</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#EFE7D6]">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        {entry.successful ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-chart-2" />
                        ) : (
                          <XCircle className="size-3.5 shrink-0 text-destructive" />
                        )}
                        <span className="truncate">{entry.action}</span>
                        {entry.isWrite ? (
                          <PenLine className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <Eye className="size-3 shrink-0 text-muted-foreground/50" />
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{entry.integration}</td>
                    <td className="py-2 pr-3">
                      {entry.agent ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {entry.agent.toLowerCase()}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(entry.at).toLocaleString()}
                    </td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      {entry.durationMs === null ? "—" : `${entry.durationMs} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.nextCursor && (
          <Button
            variant="outline"
            size="sm"
            className="self-start text-xs"
            onClick={() => setFilters((prev) => ({ ...prev, before: data.nextCursor! }))}
          >
            Load older
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
