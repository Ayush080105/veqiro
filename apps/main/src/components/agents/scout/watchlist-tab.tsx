"use client"

import * as React from "react"
import {
  Crosshair,
  ExternalLink,
  Trash2,
  Loader2,
  Globe,
  Plus,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCompetitorWatches, useRemoveCompetitorWatch } from "@/lib/api/scout"

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export function ScoutWatchlistTab({
  onDiscover,
  onResearch,
}: {
  onDiscover: () => void
  onResearch: (name: string, url: string) => void
}) {
  const { data: competitors = [], isLoading, error } = useCompetitorWatches()
  const removeMut = useRemoveCompetitorWatch()

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeMut.mutateAsync(id)
      toast.success(`Removed "${name}" from watchlist`)
    } catch {
      toast.error("Failed to remove competitor")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading watchlist…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
        Failed to load competitors.
      </div>
    )
  }

  if (competitors.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-border bg-muted/30">
          <Crosshair className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No competitors saved yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Discover competitors in your market and save them here for quick access.
          </p>
        </div>
        <Button onClick={onDiscover} className="mt-2" size="sm">
          <Plus data-icon="inline-start" /> Discover competitors
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Competitor watchlist</p>
          <p className="text-xs text-muted-foreground">
            {competitors.length} competitor{competitors.length === 1 ? "" : "s"} saved
          </p>
        </div>
        <Button onClick={onDiscover} size="sm">
          <Plus data-icon="inline-start" /> Discover more
        </Button>
      </div>

      <div className="border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitors.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="text-xs font-medium">{c.name}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="size-3 shrink-0" />
                    <span className="truncate max-w-50">
                      {c.url.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(c.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onResearch(c.name, c.url)}
                      title="Research this company"
                    >
                      <Search data-icon="inline-start" className="size-3" /> Research
                    </Button>
                    <Button variant="outline" size="xs" asChild title="Open website">
                      <a href={c.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={removeMut.isPending}
                      onClick={() => handleRemove(c.id, c.name)}
                      title="Remove from watchlist"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
