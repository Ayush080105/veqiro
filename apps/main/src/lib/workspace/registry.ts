import type { AgentSlug } from "@/lib/types"
import { MODULE_ORDER } from "./modules"
import type { AgentWorkspaceSpec, ModuleId, ModuleSpec } from "./types"
import { lexWorkspace } from "./agents/lex.workspace"
import { mayaWorkspace } from "./agents/maya.workspace"
import {
  rexWorkspace,
  sageWorkspace,
  scoutWorkspace,
  vegaWorkspace,
} from "./agents/pending.workspace"

/**
 * Every agent's workspace spec.
 *
 * Note what is NOT in this file: any branch on which agent is which. The specs
 * are data, the framework reads them uniformly, and agent-specific behaviour
 * lives inside the agent's own lazy components. If a change to this file needs
 * a slug literal, the right fix is almost always a new field on ModuleSpec or
 * AgentWorkspaceSpec that at least two agents will use.
 */
export const WORKSPACE_REGISTRY: Record<AgentSlug, AgentWorkspaceSpec> = {
  lex: lexWorkspace,
  maya: mayaWorkspace,
  rex: rexWorkspace,
  sage: sageWorkspace,
  scout: scoutWorkspace,
  vega: vegaWorkspace,
}

export function getWorkspaceSpec(agent: string): AgentWorkspaceSpec | undefined {
  return WORKSPACE_REGISTRY[agent as AgentSlug]
}

export function isWorkspaceAgent(agent: string): agent is AgentSlug {
  return agent in WORKSPACE_REGISTRY
}

export interface ResolvedModule extends ModuleSpec {
  id: ModuleId
  status: "ready" | "coming-soon"
}

/**
 * The spec's sparse module overrides merged onto the canonical order.
 *
 * Anything an agent does not mention is "coming-soon" rather than absent: the
 * route resolves, the nav shows it under More, and the customer sees a roadmap
 * instead of a dead end. Overview and chat are always ready — every agent has
 * a chat thread and an overview can always render insights and activity, even
 * when they are empty.
 */
export function resolveModules(spec: AgentWorkspaceSpec): ResolvedModule[] {
  const overrides = new Map((spec.modules ?? []).map((m) => [m.id, m]))

  return MODULE_ORDER.map((id) => {
    const override = overrides.get(id)
    const hasWork = id === "work" && spec.workTypes.length > 0
    const alwaysReady = id === "overview" || id === "chat"

    return {
      id,
      ...override,
      status: override?.status ?? (alwaysReady || hasWork ? "ready" : "coming-soon"),
      // The dock already shows chat on every module, so a desktop nav entry for
      // it would just be a second door into the same room.
      hiddenInNav: override?.hiddenInNav ?? id === "chat",
    }
  })
}

export function getWorkType(spec: AgentWorkspaceSpec, slug: string) {
  return spec.workTypes.find((w) => w.slug === slug)
}
