"use client"

import { Check, Sparkles, X } from "lucide-react"

import {
  useSetInsightStatus,
  type Insight,
  type InsightSeverity,
} from "@/lib/api/workspace"
import type { AgentActionId } from "@/lib/types/agents"
import { findAction } from "@/lib/agents/actions"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useWorkspaceChat } from "../WorkspaceChatProvider"

const LEVEL: Record<InsightSeverity, "danger" | "warn" | "info"> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warn",
  LOW: "info",
  INFO: "info",
}

/**
 * The "X noticed..." cards.
 *
 * A finding that cannot be acted on or dismissed is just a nag, so every row
 * has both: suggestedActionId opens the same action form the composer would,
 * prefilled, and dismissing writes through so the next scan does not resurface
 * it within the same period.
 */
export function InsightList({
  agent,
  organizationId,
  insights,
  loading,
}: {
  agent: string
  organizationId: string
  insights?: Insight[]
  loading?: boolean
}) {
  const { openAction } = useWorkspaceChat()
  const setStatus = useSetInsightStatus(agent, organizationId)

  if (loading) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-14 rounded-[var(--vq-r-sm)]" />
        <Skeleton className="h-14 rounded-[var(--vq-r-sm)]" />
      </div>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <EmptyState
        tone="plain"
        icon={<Sparkles />}
        title="Nothing needs your attention"
        description="Findings, risks and opportunities will appear here as they're spotted."
      />
    )
  }

  return (
    <ul className="mt-2 flex flex-col divide-y divide-(--vq-line-2)">
      {insights.map((insight) => {
        const action = insight.suggestedActionId
          ? findAction(insight.suggestedActionId as AgentActionId)
          : undefined

        return (
          <li key={insight.id} className="flex flex-wrap items-center gap-2 py-3">
            <StatusPill level={LEVEL[insight.severity]} className="shrink-0">
              {insight.severity.toLowerCase()}
            </StatusPill>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{insight.title}</p>
              {insight.body && (
                <p className="truncate text-xs text-muted-foreground">{insight.body}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openAction(
                      insight.suggestedActionId as AgentActionId,
                      insight.suggestedArgs ?? undefined,
                    )
                  }
                >
                  {action.label}
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mark as handled"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: insight.id, status: "ACTED" })}
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Dismiss"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: insight.id, status: "DISMISSED" })}
              >
                <X className="size-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
