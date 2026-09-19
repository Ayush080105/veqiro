import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"

import type { AgentWorkspaceSpec } from "../types"

/**
 * Vega — the executive layer.
 *
 * Migrated last on purpose: it reports on the other five, so it wanted them to
 * exist first. Its overview leads with the company pulse, which is the PRD's
 * acceptance criterion for Vega made literal — the whole workforce summarised
 * without opening a single other workspace.
 *
 * Its one action is the daily briefing, which reads the same pulse and turns it
 * into something a person can read over coffee. Its own work objects
 * (Initiatives, Decisions, Delegations) are still to come.
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
      {
        id: "vega-outcomes",
        span: "full",
        Component: lazy(() =>
          import("@/components/workspace/agents/vega/VegaOutcomes").then((m) => ({
            default: m.VegaOutcomes,
          })),
        ),
      },
    ],
    quickActions: ["vega:daily-briefing" as AgentActionId],
  },
}
