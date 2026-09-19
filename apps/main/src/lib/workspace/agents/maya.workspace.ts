import { lazy } from "react"

import { mergeMayaMessages } from "@/lib/agents/maya/message-merge"
import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Maya — the second workspace, and the test of whether the framework holds.
 *
 * Note what is here that Lex did not need: three work types, a message
 * transform, and header extras. Note what is not here: any new framework
 * concept. Every one of those slotted into a field the spec already had, which
 * is the answer to "is this abstraction real or is it isMaya with extra steps".
 */
export const mayaWorkspace: AgentWorkspaceSpec = {
  agent: "maya",

  workTypes: [
    {
      slug: "posts",
      label: "Posts",
      labelSingular: "Post",
      kind: "maya.post",
      List: lazy(() =>
        import("@/components/workspace/agents/maya/MayaWork").then((m) => ({
          default: m.MayaPostsWork,
        })),
      ),
      createActions: [
        "maya:draft-content" as AgentActionId,
        "maya:draft-carousel" as AgentActionId,
      ],
    },
    {
      slug: "campaigns",
      label: "Campaigns",
      labelSingular: "Campaign",
      kind: "maya.campaign",
      List: lazy(() =>
        import("@/components/workspace/agents/maya/MayaCampaignsWork").then((m) => ({
          default: m.MayaCampaignsWork,
        })),
      ),
      createActions: ["maya:campaign" as AgentActionId],
    },
    {
      slug: "plan",
      label: "Content plan",
      labelSingular: "Plan",
      kind: "maya.plan",
      List: lazy(() =>
        import("@/components/workspace/agents/maya/MayaWork").then((m) => ({
          default: m.MayaPlansWork,
        })),
      ),
    },
  ],

  overview: {
    widgets: [],
    quickActions: [
      "maya:generate-ideas" as AgentActionId,
      "maya:draft-content" as AgentActionId,
      "maya:campaign" as AgentActionId,
      "maya:content-plan" as AgentActionId,
    ],
  },

  // The credits pill and top-up button followed the customer around the old
  // chat header, and should keep doing so — running out of credits mid-task is
  // the thing they most need warning about.
  headerExtras: [
    lazy(() =>
      import("@/components/agents/maya/credits-pill").then((m) => ({
        default: m.MayaCreditsPill,
      })),
    ),
    lazy(() =>
      import("@/components/agents/maya/topup-dialog").then((m) => ({
        default: m.MayaTopUpButton,
      })),
    ),
  ],

  transformMessages: mergeMayaMessages,
}
