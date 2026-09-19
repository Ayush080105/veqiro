import type { AgentWorkspaceSpec } from "../types"

/**
 * Vega — registered, but with no work of its own yet.
 *
 * Its route resolves and Overview, Approvals, Activity, Memory, Integrations
 * and Chat all work from framework defaults. Two things are honestly missing
 * rather than accidentally so:
 *
 *  - Vega has zero entries in the action catalog, so its Actions module is
 *    empty. That is a content gap, not a bug, and it is worth seeing.
 *  - Its work objects are Initiatives, Decisions and Delegations, which are
 *    cross-agent by definition. Vega coordinates the other five, so it wants
 *    them migrated first and it wants the Handoff protocol live — which is
 *    exactly what the workforce phase is for. Building it earlier would mean
 *    inventing a coordination layer with nothing to coordinate.
 *
 * VegaFollowUp, VIPContact and VegaLabel already exist as tables and will
 * become its first work types.
 */
export const vegaWorkspace: AgentWorkspaceSpec = {
  agent: "vega",
  workTypes: [],
  overview: { widgets: [] },
}
