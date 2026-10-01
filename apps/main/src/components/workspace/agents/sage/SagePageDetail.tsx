"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

import {
  useSeoPage,
  useSetIssueStatus,
  type SeoIssue,
  type SeoIssueSeverity,
} from "@/lib/api/workspace"
import type { WorkDetailProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"

const SEVERITY_LEVEL: Record<SeoIssueSeverity, "danger" | "warn" | "info"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warn",
  QUICK_WIN: "info",
}

const SEVERITY_LABEL: Record<SeoIssueSeverity, string> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  QUICK_WIN: "quick win",
}

/**
 * One page, its score history and its issue queue.
 *
 * Marking an issue fixed is a claim, not a fact — the next audit still decides.
 * That is why the status lives on the issue rather than the issue being
 * deleted: a fix that did not take should come back, and be seen to come back.
 */
export function SagePageDetail({ objectId, organizationId }: WorkDetailProps) {
  const { hrefFor } = useAgentWorkspace()
  const { data, isLoading, error } = useSeoPage(objectId)
  const setStatus = useSetIssueStatus(organizationId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-40 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Page not found"
        description="It may no longer be tracked."
        action={{ label: "Back to pages", href: hrefFor("work", "pages") }}
      />
    )
  }

  const open = data.issues.filter((i) => i.status === "OPEN")
  const settled = data.issues.filter((i) => i.status !== "OPEN")

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div>
        <Link
          href={hrefFor("work", "pages")}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          All pages
        </Link>
        <h1 className="font-head text-xl">{data.title || data.url}</h1>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          {data.url}
          <ExternalLink className="size-3" />
        </a>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-[var(--vq-r)] border border-border bg-card p-4">
        <div>
          <p className="font-head text-3xl leading-none">{data.score ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.previousScore === null
              ? "first audit"
              : `was ${data.previousScore}`}
          </p>
        </div>
        {data.nextMove && (
          <div className="min-w-0 flex-1 border-l border-(--vq-line-2) pl-4">
            <p className="text-xs text-muted-foreground">Next move</p>
            <p className="mt-0.5 text-sm">{data.nextMove}</p>
          </div>
        )}
      </section>

      {data.summary && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Sage&apos;s read</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.summary}</p>
        </section>
      )}

      <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
        <h2 className="font-head text-sm">
          To fix{open.length > 0 && ` (${open.length})`}
        </h2>
        {open.length === 0 ? (
          <EmptyState
            tone="plain"
            title="Nothing outstanding"
            description="The last audit found no open issues on this page."
          />
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
            {open.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                busy={setStatus.isPending}
                onFix={() => setStatus.mutate({ id: issue.id, status: "FIXED" })}
                onIgnore={() => setStatus.mutate({ id: issue.id, status: "IGNORED" })}
              />
            ))}
          </ul>
        )}
      </section>

      {settled.length > 0 && (
        <section className="rounded-[var(--vq-r)] border border-border bg-card p-4">
          <h2 className="font-head text-sm">Settled</h2>
          <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
            {settled.map((issue) => (
              <li key={issue.id} className="flex items-center gap-3 py-2.5">
                <StatusPill level="info" className="shrink-0">
                  {issue.status.toLowerCase()}
                </StatusPill>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {issue.description}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: issue.id, status: "OPEN" })}
                >
                  Reopen
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function IssueRow({
  issue,
  busy,
  onFix,
  onIgnore,
}: {
  issue: SeoIssue
  busy: boolean
  onFix: () => void
  onIgnore: () => void
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5">
      <StatusPill level={SEVERITY_LEVEL[issue.severity]} className="mt-0.5 shrink-0">
        {SEVERITY_LABEL[issue.severity]}
      </StatusPill>
      <span className="min-w-0 flex-1 text-sm">{issue.description}</span>
      <span className="flex shrink-0 gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={onFix}>
          Fixed
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onIgnore}>
          Ignore
        </Button>
      </span>
    </li>
  )
}
