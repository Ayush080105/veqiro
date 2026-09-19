import { lazy } from "react"

import type { AgentWorkspaceSpec } from "../types"

/**
 * Vega — the executive layer.
 *
 * Migrated last on purpose: it reports on the other five, so it wanted them to
 * exist first. Its overview leads with the company pulse, which is the PRD's
 * acceptance criterion for Vega made literal — the whole workforce summarised
 * without opening a single other workspace.
 *
 * Still honestly incomplete. Vega has no entries in the action catalog, so its
 * Actions module is empty, and its own work objects (Initiatives, Decisions,
 * Delegations) wait on the Handoff protocol being driveable from the UI rather
 * than only from the API.
 */
export const vegaWorkspace: AgentWorkspaceSpec = {
  agent: "vega",

  workTypes: [],

  overview: {
    widgets: [
      {
        id: "vega-company-pulse",
        span: "full",
        Component: lazy(() =>
          import("@/components/workspace/agents/vega/VegaCompanyPulse").then((m) => ({
            default: m.VegaCompanyPulse,
          })),
        ),
      },
    ],
  },
}
