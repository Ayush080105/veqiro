"use client"

import { useRouter } from "next/navigation"
import { FileSearch, TrendingDown, TrendingUp } from "lucide-react"

import { useSeoPages, type SeoPageSummary } from "@/lib/api/workspace"

import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"

/**
 * Pages Sage watches.
 *
 * Sorted worst-score-first, because a list of pages sorted by URL is a
 * directory and a list sorted by score is a work queue — and the PRD asks for
 * a page-level opportunity queue, not an inventory.
 */
export function SagePagesWork() {
  const router = useRouter()
  const { hrefFor } = useAgentWorkspace()
  const { data, isLoading } = useSeoPages()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
        <Skeleton className="h-16 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch />}
        title="No pages audited yet"
        description="Run a page or site audit and Sage will start tracking scores and issues here."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((page) => (
        <li key={page.id}>
          <button
            type="button"
            onClick={() => router.push(hrefFor("work", `pages/${page.id}`))}
            className="flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
          >
            <ScoreBadge page={page} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {page.title || page.url}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {page.targetKeyword ? `for "${page.targetKeyword}"` : page.url}
              </span>
            </span>

            {page.openIssues > 0 ? (
              <StatusPill level={page.openIssues > 3 ? "danger" : "warn"} className="shrink-0">
                {page.openIssues} to fix
              </StatusPill>
            ) : (
              <StatusPill level="ok" className="shrink-0">
                Clean
              </StatusPill>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Score with its direction since the previous audit — the point of tracking. */
function ScoreBadge({ page }: { page: SeoPageSummary }) {
  if (page.score === null) {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted text-xs text-muted-foreground">
        —
      </span>
    )
  }

  const delta = page.previousScore === null ? null : page.score - page.previousScore

  return (
    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-[var(--vq-r-sm)] bg-muted">
      <span className="font-head text-sm leading-none">{page.score}</span>
      {delta !== null && delta !== 0 && (
        <span
          className={
            delta > 0
              ? "mt-0.5 flex items-center text-[10px] text-[color:var(--vq-green)]"
              : "mt-0.5 flex items-center text-[10px] text-destructive"
          }
        >
          {delta > 0 ? (
            <TrendingUp className="size-2.5" />
          ) : (
            <TrendingDown className="size-2.5" />
          )}
          {Math.abs(delta)}
        </span>
      )}
    </span>
  )
}
