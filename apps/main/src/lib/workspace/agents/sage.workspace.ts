import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Sage — SEO.
 *
 * Saved keywords are the only thing Sage persists today; the audits are
 * stateless endpoints. Making those durable (SeoPage / SeoIssue, so an audit
 * becomes a tracked issue queue rather than a one-off answer) is the PRD's
 * "continuous monitoring" work and belongs to the proactive phase, not here.
 */
export const sageWorkspace: AgentWorkspaceSpec = {
  agent: "sage",

  workTypes: [
    {
      slug: "keywords",
      label: "Keywords",
      labelSingular: "Keyword",
      kind: "sage.keyword",
      List: lazy(() =>
        import("@/components/workspace/agents/sage/SageWork").then((m) => ({
          default: m.SageKeywordsWork,
        })),
      ),
      createActions: ["sage:keyword-research" as AgentActionId],
    },
  ],

  overview: {
    widgets: [],
    quickActions: [
      "sage:keyword-research" as AgentActionId,
      "sage:site-audit" as AgentActionId,
      "sage:content-brief" as AgentActionId,
      "sage:generate-blog" as AgentActionId,
    ],
  },
}
