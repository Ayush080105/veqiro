import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/** Rex — finance. Datasets are his work; pinned numbers lead the overview. */
export const rexWorkspace: AgentWorkspaceSpec = {
  agent: "rex",

  workTypes: [
    {
      slug: "datasets",
      label: "Datasets",
      labelSingular: "Dataset",
      kind: "rex.dataset",
      List: lazy(() =>
        import("@/components/workspace/agents/rex/RexWork").then((m) => ({
          default: m.RexDatasetsWork,
        })),
      ),
      createActions: ["rex:analyze-metrics" as AgentActionId],
    },
  ],

  overview: {
    widgets: [
      {
        id: "rex-today",
        span: "full",
        Component: lazy(() =>
          import("@/components/workspace/agents/rex/RexWork").then((m) => ({
            default: m.RexTodayWidget,
          })),
        ),
      },
    ],
    quickActions: [
      "rex:analyze-metrics" as AgentActionId,
      "rex:runway" as AgentActionId,
      "rex:forecast" as AgentActionId,
      "rex:weekly-digest" as AgentActionId,
    ],
  },
}
