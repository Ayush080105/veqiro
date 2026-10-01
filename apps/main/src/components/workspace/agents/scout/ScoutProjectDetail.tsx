"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

import { useResearchProject, type ResearchFinding } from "@/lib/api/workspace"
import type { WorkDetailProps } from "@/lib/workspace/types"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"

const CONFIDENCE_LEVEL = {
  HIGH: "ok",
  MEDIUM: "info",
  LOW: "warn",
} as const

/**
 * One research project with everything it rests on.
 *
 * This is the PRD's evidence requirement made concrete: every finding shows
 * how strongly it is held and, where it came from one source, links to it with
 * the date it was read. A claim you cannot check is a claim you cannot use.
 */
export function ScoutProjectDetail({ objectId }: WorkDetailProps) {
  const { hrefFor } = useAgentWorkspace()
  const { data, isLoading, error } = useResearchProject(objectId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-32 rounded-[var(--vq-r)]" />
        <Skeleton className="h-48 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Research not found"
        description="This project may have been deleted."
        action={{ label: "Back to research", href: hrefFor("work", "research") }}
      />
    )
  }

  const sourcesById = new Map(data.sources.map((source) => [source.id, source]))
  const byCategory = groupByCategory(data.findings)

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div>
        <Link
          href={hrefFor("work", "research")}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          All research
        </Link>
        <h1 className="font-head text-xl">{data.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.question}</p>
      </div>

      {data.summary && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Bottom line</h2>
          <p className="mt-2 text-sm">{data.summary}</p>
        </section>
      )}

      {data.findings.length > 0 && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Findings</h2>
          <div className="mt-2 flex flex-col gap-4">
            {[...byCategory.entries()].map(([category, findings]) => (
              <div key={category}>
                {category && (
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {category}
                  </p>
                )}
                <ul className="flex flex-col divide-y divide-(--vq-line-2)">
                  {findings.map((finding) => {
                    const source = finding.sourceId
                      ? sourcesById.get(finding.sourceId)
                      : undefined
                    return (
                      <li key={finding.id} className="flex items-start gap-3 py-2.5">
                        <StatusPill
                          level={CONFIDENCE_LEVEL[finding.confidence]}
                          className="mt-0.5 shrink-0"
                        >
                          {finding.confidence.toLowerCase()}
                        </StatusPill>
                        <span className="min-w-0 flex-1 text-sm">
                          {finding.statement}
                          {source && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground"
                            >
                              {source.publisher ?? "source"}
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <h2 className="font-head text-sm">
          Sources{data.sources.length > 0 && ` (${data.sources.length})`}
        </h2>
        {data.sources.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sources were recorded for this project.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
            {data.sources.map((source) => (
              <li key={source.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm"
                  >
                    {source.title}
                  </a>
                  <span className="block truncate text-xs text-muted-foreground">
                    {source.publisher ?? new URL(source.url).hostname}
                  </span>
                </div>
                {/* When it was read, which is what tells you whether to trust it now. */}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(source.retrievedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function groupByCategory(findings: ResearchFinding[]): Map<string, ResearchFinding[]> {
  const grouped = new Map<string, ResearchFinding[]>()
  for (const finding of findings) {
    const key = finding.category || ""
    const existing = grouped.get(key)
    if (existing) existing.push(finding)
    else grouped.set(key, [finding])
  }
  return grouped
}
