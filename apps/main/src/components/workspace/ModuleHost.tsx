"use client"

import { Suspense, lazy, useMemo } from "react"

import type { ModuleId } from "@/lib/workspace/types"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { OverviewModule } from "./modules/OverviewModule"
import { ActionsModule } from "./modules/ActionsModule"
import { AutomationsModule } from "./modules/AutomationsModule"
import {
  ActivityModule,
  ApprovalsModule,
  ComingSoonModule,
  IntegrationsModule,
  MemoryModule,
} from "./modules/SimpleModules"

const WorkModule = lazy(() =>
  import("./modules/WorkModule").then((m) => ({ default: m.WorkModule })),
)
const ChatModule = lazy(() =>
  import("./modules/ChatModule").then((m) => ({ default: m.ChatModule })),
)

/**
 * Resolves one module id to a component.
 *
 * Every module page is a one-line call to this, so the routing layer stays
 * boring and all the resolution logic lives in one readable place: the agent's
 * own override if it has one, otherwise the framework default, otherwise an
 * honest "coming soon".
 */
export function ModuleHost({ module }: { module: ModuleId }) {
  const { agent, organizationId, modules } = useAgentWorkspace()
  const resolved = useMemo(() => modules.find((m) => m.id === module), [modules, module])

  if (!resolved || resolved.status !== "ready") {
    return <ComingSoonModule moduleId={module} />
  }

  const props = { agent, organizationId }

  if (resolved.Component) {
    return (
      <Suspense fallback={<ModuleSkeleton />}>
        <resolved.Component {...props} />
      </Suspense>
    )
  }

  switch (module) {
    case "overview":
      return <OverviewModule {...props} />
    case "actions":
      return <ActionsModule {...props} />
    case "activity":
      return <ActivityModule {...props} />
    case "approvals":
      return <ApprovalsModule {...props} />
    case "memory":
      return <MemoryModule {...props} />
    case "integrations":
      return <IntegrationsModule {...props} />
    case "automations":
      return <AutomationsModule {...props} />
    case "work":
      return (
        <Suspense fallback={<ModuleSkeleton />}>
          <WorkModule {...props} />
        </Suspense>
      )
    case "chat":
      return (
        <Suspense fallback={<ModuleSkeleton />}>
          <ChatModule />
        </Suspense>
      )
    default:
      return <ComingSoonModule moduleId={module} />
  }
}

function ModuleSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-48 rounded-md" />
      <Skeleton className="h-40 rounded-[var(--vq-r)]" />
    </div>
  )
}
