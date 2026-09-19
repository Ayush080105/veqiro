"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import type { AgentConfig, AgentSlug } from "@/lib/types"
import type { AgentWorkspaceSpec, ModuleId } from "@/lib/workspace/types"
import { resolveModules, type ResolvedModule } from "@/lib/workspace/registry"

interface AgentWorkspaceValue {
  agent: AgentSlug
  config: AgentConfig
  spec: AgentWorkspaceSpec
  organizationId: string
  modules: ResolvedModule[]
  /** The module segment currently showing, derived from the URL. */
  activeModule: ModuleId
  hrefFor: (module: ModuleId, rest?: string) => string
  goTo: (module: ModuleId, rest?: string) => void
}

const Ctx = createContext<AgentWorkspaceValue | null>(null)

export function AgentWorkspaceProvider({
  agent,
  config,
  spec,
  organizationId,
  children,
}: {
  agent: AgentSlug
  config: AgentConfig
  spec: AgentWorkspaceSpec
  organizationId: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const value = useMemo<AgentWorkspaceValue>(() => {
    const base = `/workspace/${agent}`
    // pathname is /workspace/<agent>/<module>/...; anything unrecognised is
    // the index redirect on its way to overview.
    const segment = pathname.slice(base.length).split("/").filter(Boolean)[0]
    const modules = resolveModules(spec)
    const activeModule = (modules.find((m) => m.id === segment)?.id ?? "overview") as ModuleId

    const hrefFor = (module: ModuleId, rest?: string) =>
      rest ? `${base}/${module}/${rest}` : `${base}/${module}`

    return {
      agent,
      config,
      spec,
      organizationId,
      modules,
      activeModule,
      hrefFor,
      goTo: (module, rest) => router.push(hrefFor(module, rest)),
    }
  }, [agent, config, spec, organizationId, pathname, router])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAgentWorkspace(): AgentWorkspaceValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error("useAgentWorkspace must be used inside a workspace layout")
  }
  return ctx
}
