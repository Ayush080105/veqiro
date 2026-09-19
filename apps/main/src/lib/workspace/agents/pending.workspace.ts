import type { AgentWorkspaceSpec } from "../types"

/**
 * The five agents not yet migrated.
 *
 * They are registered rather than omitted so /workspace/<agent> resolves to a
 * real page instead of a 404 — Overview, Actions and Chat all work today from
 * the framework defaults, because the action catalog and the chat thread
 * already exist for each of them. What they lack is work types, so the Work
 * module reports itself as coming soon rather than pretending.
 *
 * Migrating one means giving it workTypes and overview widgets here, then
 * adding it to WORKSPACE_MIGRATED so /assistants/<agent> starts redirecting.
 * Nothing else has to change.
 */
const pending = (agent: AgentWorkspaceSpec["agent"]): AgentWorkspaceSpec => ({
  agent,
  workTypes: [],
  overview: { widgets: [] },
})

export const rexWorkspace = pending("rex")
export const sageWorkspace = pending("sage")
export const scoutWorkspace = pending("scout")
export const vegaWorkspace = pending("vega")
