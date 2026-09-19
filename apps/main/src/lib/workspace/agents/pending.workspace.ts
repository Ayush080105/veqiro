import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Agents whose workspace has an Overview, Actions and Chat but no Work yet.
 *
 * Registered rather than omitted so their routes resolve to something real:
 * the action catalog and the chat thread already exist for them, so three
 * modules work today from framework defaults alone. What they lack is durable
 * domain objects, which is a schema question rather than a UI one.
 *
 * Scout is the clearest case — it has four actions and nothing to show for
 * them, because research is still one-off chat. Giving it ResearchProject /
 * Source / Finding is what turns those answers into work, and that is the next
 * piece of real schema after Campaign.
 *
 * Vega is deliberately last: it owns cross-agent coordination, and the handoff
 * primitives it needs only become useful once there are other workspaces to
 * coordinate. It also has zero entries in the action catalog, so its Actions
 * module is honestly empty rather than accidentally so.
 */
const pending = (
  agent: AgentWorkspaceSpec["agent"],
  quickActions: AgentActionId[] = [],
): AgentWorkspaceSpec => ({
  agent,
  workTypes: [],
  overview: { widgets: [], quickActions },
})

export const scoutWorkspace = pending("scout", [
  "scout:research-topic" as AgentActionId,
  "scout:research-company" as AgentActionId,
  "scout:discover-competitors" as AgentActionId,
  "scout:trending-topics" as AgentActionId,
])

export const vegaWorkspace = pending("vega")
