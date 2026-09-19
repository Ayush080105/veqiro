import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Sage — SEO.
 *
 * Two work types: keywords, and the pages Sage watches. Pages are the
 * interesting one — an audit used to be a score that scrolled away, so there
 * was no way to know whether last month's work helped. Now the page keeps its
 * score history and its issues keep their status, which is what turns an audit
 * into monitoring.
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
    {
      slug: "pages",
      label: "Pages",
      labelSingular: "Page",
      kind: "sage.page",
      List: lazy(() =>
        import("@/components/workspace/agents/sage/SagePagesWork").then((m) => ({
          default: m.SagePagesWork,
        })),
      ),
      Detail: lazy(() =>
        import("@/components/workspace/agents/sage/SagePageDetail").then((m) => ({
          default: m.SagePageDetail,
        })),
      ),
      createActions: [
        "sage:page-seo-audit" as AgentActionId,
        "sage:site-audit" as AgentActionId,
      ],
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
