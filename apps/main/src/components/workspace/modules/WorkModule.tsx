"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { findAction } from "@/lib/agents/actions"
import type { ModuleProps } from "@/lib/workspace/types"
import { getWorkType } from "@/lib/workspace/registry"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAgentWorkspace } from "../AgentWorkspaceContext"
import { useWorkspaceChat } from "../WorkspaceChatProvider"
import { ComingSoonModule } from "./SimpleModules"

/**
 * The Work module: a type switcher plus whichever list the agent registered.
 *
 * The lists are the agent's existing tab components, reused unchanged — the
 * adapter that maps their callback props onto openAction and the URL lives in
 * each agent's own components, not here.
 */
export function WorkModule({ agent, organizationId }: ModuleProps) {
  const { spec, hrefFor } = useAgentWorkspace()
  const { openAction } = useWorkspaceChat()
  const params = useParams<{ type?: string; objectId?: string }>()

  if (spec.workTypes.length === 0) {
    return <ComingSoonModule moduleId="work" />
  }

  // No type in the URL means /work itself — show the first registered type
  // rather than an index page nobody wants to click through.
  const activeSlug = params.type ?? spec.workTypes[0]!.slug
  const workType = getWorkType(spec, activeSlug)

  if (!workType) {
    return (
      <EmptyState
        title="Unknown work type"
        description="That kind of work doesn't exist for this employee."
        action={{ label: "Back to work", href: hrefFor("work") }}
      />
    )
  }

  const { List, Detail } = workType

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {spec.workTypes.length > 1 && (
          // Scrolls sideways rather than wrapping or pushing the page wider:
          // an agent with four or five work types does not fit one phone row.
          <nav
            className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]"
            aria-label="Work types"
          >
            {spec.workTypes.map((type) => (
              <Link
                key={type.slug}
                href={hrefFor("work", type.slug)}
                className={cn(
                  "shrink-0 rounded-[var(--vq-r-sm)] px-2.5 py-1.5 text-sm whitespace-nowrap no-underline transition-colors",
                  type.slug === activeSlug
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {type.label}
              </Link>
            ))}
          </nav>
        )}

        <span className="hidden flex-1 sm:block" />

        {/* On a phone the create buttons take their own row instead of
            squeezing beside the tabs. */}
        {(workType.createActions?.length ?? 0) > 0 && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {workType.createActions?.map((id) => {
              const action = findAction(id)
              if (!action) return null
              return (
                <Button key={id} size="sm" variant="outline" onClick={() => openAction(id)}>
                  {action.label}
                </Button>
              )
            })}
          </div>
        )}
      </div>

      <Suspense fallback={<Skeleton className="h-64 rounded-[var(--vq-r)]" />}>
        {params.objectId && Detail ? (
          <Detail agent={agent} organizationId={organizationId} objectId={params.objectId} />
        ) : (
          <List agent={agent} organizationId={organizationId} openObjectId={params.objectId} />
        )}
      </Suspense>
    </div>
  )
}
