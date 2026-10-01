"use client"

import { Suspense } from "react"

import { useAgentWorkspace } from "./AgentWorkspaceContext"

/**
 * Agent-specific header controls (Maya's credits pill and top-up button).
 *
 * Its own file because two places render it: the header from `md` up, and the
 * module sheet on phones, where there is no room for it in the header bar.
 */
export function HeaderExtras({ className }: { className?: string }) {
  const { spec, agent, organizationId } = useAgentWorkspace()
  if (!spec.headerExtras?.length) return null
  return (
    <div className={className ?? "flex shrink-0 items-center gap-2"}>
      {spec.headerExtras.map((Extra, i) => (
        <Suspense key={i} fallback={null}>
          <Extra agent={agent} organizationId={organizationId} />
        </Suspense>
      ))}
    </div>
  )
}
