import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Scout — research.
 *
 * The agent that changed most in migrating: it had four actions and nothing to
 * show for them, because every answer scrolled away with its sources. Research
 * projects give the work somewhere to live, and the detail route is the
 * evidence panel the PRD asks for.
 */
export const scoutWorkspace: AgentWorkspaceSpec = {
  agent: "scout",

  workTypes: [
    {
      slug: "research",
      label: "Research",
      labelSingular: "Project",
      kind: "scout.project",
      List: lazy(() =>
        import("@/components/workspace/agents/scout/ScoutProjectsWork").then((m) => ({
          default: m.ScoutProjectsWork,
        })),
      ),
      Detail: lazy(() =>
        import("@/components/workspace/agents/scout/ScoutProjectDetail").then((m) => ({
          default: m.ScoutProjectDetail,
        })),
      ),
      createActions: [
        "scout:research-topic" as AgentActionId,
        "scout:research-company" as AgentActionId,
      ],
    },
  ],

  overview: {
    widgets: [],
    quickActions: [
      "scout:research-topic" as AgentActionId,
      "scout:research-company" as AgentActionId,
      "scout:discover-competitors" as AgentActionId,
      "scout:trending-topics" as AgentActionId,
    ],
  },

  // Scout's research tools call their own data source internally and cannot be
  // reliably prompted to prefer a connected one, so the org picks explicitly.
  chatHeaderExtras: [
    lazy(() =>
      import("@/components/workspace/chat/dock-extras/ScoutSearchSource").then((m) => ({
        default: m.ScoutSearchSource,
      })),
    ),
  ],
}
