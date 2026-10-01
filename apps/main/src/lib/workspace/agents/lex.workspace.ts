import { lazy } from "react"

import type { AgentActionId } from "@/lib/types/agents"
import type { AgentWorkspaceSpec } from "../types"

/**
 * Lex — the pilot workspace.
 *
 * Everything here points at components that already exist and already work.
 * The spec is deliberately small: that smallness is the evidence that the
 * framework is carrying its weight, and it is what the next five agents copy.
 */
export const lexWorkspace: AgentWorkspaceSpec = {
  agent: "lex",

  workTypes: [
    {
      slug: "documents",
      label: "Documents",
      labelSingular: "Document",
      kind: "lex.contract",
      List: lazy(() =>
        import("@/components/workspace/agents/lex/LexDocumentsWork").then((m) => ({
          default: m.LexDocumentsWork,
        })),
      ),
      createActions: ["lex:upload-source" as AgentActionId, "lex:draft-document" as AgentActionId],
    },
  ],

  overview: {
    widgets: [
      {
        id: "lex-home",
        span: "full",
        Component: lazy(() =>
          import("@/components/workspace/agents/lex/LexOverviewWidget").then((m) => ({
            default: m.LexOverviewWidget,
          })),
        ),
      },
    ],
    // No quickActions: LexHome already leads with "Review a contract",
    // "Create a document" and "Ask about your documents", so the framework
    // row underneath would be the same three offers a second time. An agent
    // whose widget owns its calls to action does not need it.
  },

  composer: { attachments: "lex-sources" },
}
