"use client"

import * as React from "react"
import { Bookmark, Loader2, Plus, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSavedKeywords, useUnsaveKeyword } from "@/lib/api/sage"
import type { SageSavedKeyword } from "@/lib/types/agents"

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return iso
  }
}

function diffColor(d: number) {
  if (d >= 70) return "border-destructive/50 text-destructive"
  if (d >= 40) return "border-chart-3/50 text-chart-3"
  return "border-chart-2/50 text-chart-2"
}

export function SageSavedKeywordsTab({
  onGenerateBlog,
}: {
  onGenerateBlog: (keyword: SageSavedKeyword) => void
}) {
  const { data: keywords = [], isLoading, error } = useSavedKeywords()
  const removeMut = useUnsaveKeyword()

  const handleRemove = async (kw: SageSavedKeyword) => {
    try {
      await removeMut.mutateAsync(kw.id)
      toast.success(`Removed "${kw.keyword}"`)
    } catch {
      toast.error("Failed to remove keyword")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading saved keywords…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
        Failed to load saved keywords.
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-border bg-muted/30">
          <Bookmark className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No favourite keywords yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Press the heart icon on any keyword in your research results to save it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Favourite keywords</p>
          <p className="text-xs text-muted-foreground">
            {keywords.length} keyword{keywords.length === 1 ? "" : "s"} saved
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {/* Column header */}
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">keyword</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">vol/mo · diff · rel</span>
          </div>
        </div>

        {keywords.map((kw) => (
          <div
            key={kw.id}
            className="flex items-center gap-2 border border-border bg-background px-2 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{kw.keyword}</p>
              <p className="text-[10px] text-muted-foreground">
                {kw.searchIntent}{kw.suggestedContentType ? ` · ${kw.suggestedContentType}` : ""}
              </p>
            </div>

            {/* Stat badges */}
            <div className="flex shrink-0 items-center gap-1">
              {kw.searchVolumeEstimate && kw.searchVolumeEstimate !== "N/A" && (
                <Badge variant="secondary" className="text-[10px]">
                  {kw.searchVolumeEstimate}
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px]", diffColor(kw.estimatedDifficulty))}>
                {kw.estimatedDifficulty}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {Math.round(kw.relevanceScore * 100)}%
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => onGenerateBlog(kw)}
                title="Generate blog with this keyword"
              >
                <FileText className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={removeMut.isPending}
                onClick={() => handleRemove(kw)}
                title="Remove from favourites"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Click <FileText className="inline size-3" /> on any keyword to open the blog generator pre-filled with it.
      </p>
    </div>
  )
}
