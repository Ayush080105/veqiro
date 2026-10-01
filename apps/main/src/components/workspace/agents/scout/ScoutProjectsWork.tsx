"use client"

import { useRouter } from "next/navigation"
import { Building2, Eye, EyeOff, FlaskConical } from "lucide-react"

import {
  useResearchProjects,
  useUpdateResearchProject,
  type ResearchStatus,
} from "@/lib/api/workspace"
import type { WorkListProps } from "@/lib/workspace/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useAgentWorkspace } from "../../AgentWorkspaceContext"

const LEVEL: Record<ResearchStatus, "info" | "ok" | "warn"> = {
  BRIEF: "info",
  RESEARCHING: "info",
  // Findings nobody has read yet.
  READY: "warn",
  CLOSED: "ok",
  ARCHIVED: "info",
}

const LABEL: Record<ResearchStatus, string> = {
  BRIEF: "Brief",
  RESEARCHING: "Researching",
  READY: "Ready to read",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
}

/**
 * Scout's research as projects rather than answers that scrolled away.
 *
 * The counts are the point: "12 sources, 7 findings" is what makes a piece of
 * research feel like work that was done, and it is what the evidence panel on
 * the detail route opens into.
 */
export function ScoutProjectsWork({ organizationId }: WorkListProps) {
  const router = useRouter()
  const { hrefFor } = useAgentWorkspace()
  const { data, isLoading } = useResearchProjects()
  const update = useUpdateResearchProject(organizationId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 rounded-[var(--vq-r)]" />
        <Skeleton className="h-20 rounded-[var(--vq-r)]" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical />}
        title="No research yet"
        description="Ask Scout to research a topic or a company and it will be kept here with its sources and findings."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((project) => (
        <li
          key={project.id}
          className="flex flex-wrap items-center gap-3 rounded-[var(--vq-r)] border border-border bg-card p-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--vq-r-sm)] bg-muted">
            {project.subjectCompany ? (
              <Building2 className="size-4 text-muted-foreground" />
            ) : (
              <FlaskConical className="size-4 text-muted-foreground" />
            )}
          </span>

          <button
            type="button"
            onClick={() => router.push(hrefFor("work", `research/${project.id}`))}
            className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
          >
            <span className="block truncate text-sm font-medium">{project.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {project.sourceCount} {project.sourceCount === 1 ? "source" : "sources"} ·{" "}
              {project.findingCount} {project.findingCount === 1 ? "finding" : "findings"}
            </span>
          </button>

          <StatusPill level={LEVEL[project.status]} className="shrink-0">
            {LABEL[project.status]}
          </StatusPill>

          {/*
            Monitoring is stored but nothing acts on it yet — the scheduled
            re-check belongs to the proactive phase. The toggle is here because
            the intent is worth capturing when the customer has it, not because
            it does anything today.
          */}
          <Button
            size="icon"
            variant="ghost"
            aria-label={project.monitored ? "Stop watching" : "Watch for changes"}
            title={
              project.monitored
                ? "Scout will watch this for changes"
                : "Ask Scout to watch this for changes"
            }
            disabled={update.isPending}
            onClick={() => update.mutate({ id: project.id, monitored: !project.monitored })}
          >
            {project.monitored ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
        </li>
      ))}
    </ul>
  )
}
