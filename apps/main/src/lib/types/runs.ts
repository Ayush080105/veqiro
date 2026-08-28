/** Mirrors apps/server's agent-runs.types.ts. */

export type AgentRunStatus =
  | "PLANNING"
  | "AWAITING_PLAN_APPROVAL"
  | "RUNNING"
  | "AWAITING_ACTION_APPROVAL"
  | "REPLANNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "REJECTED"

export type AgentRunStepStatus =
  | "PLANNED"
  | "DISABLED"
  | "BLOCKED"
  | "READY"
  | "RUNNING"
  | "AWAITING_APPROVAL"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED"

/** No further transitions; polling stops here. */
export const TERMINAL_RUN_STATUSES: ReadonlySet<AgentRunStatus> = new Set([
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
  "REJECTED",
])

export interface RunStepPendingAction {
  id: string
  summary: string
  status: string
  toolName: string
  integrationSlug: string
}

export interface AgentRunStep {
  id: string
  key: string
  seq: number
  agent: string
  title: string
  intent: string
  integrationSlug: string | null
  isWrite: boolean
  /** Planner's blast-radius estimate, shown on write steps before approval. */
  expectedScope: string | null
  dependsOn: string[]
  status: AgentRunStepStatus
  enabled: boolean
  attempt: number
  outputText: string | null
  actionId: string | null
  actionResult: unknown
  /** Action this step paused on, for the user to review in its own form. */
  proposedActionId: string | null
  /** Arguments the model proposed, used to prefill that form. */
  proposedArgs: unknown
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  pendingActions: RunStepPendingAction[]
}

export interface AgentRun {
  id: string
  agent: string
  trigger: "CHAT" | "TRIGGER" | "PLAY"
  requestText: string
  status: AgentRunStatus
  goal: string
  planVersion: number
  approvedWrites: string[]
  approvedAt: string | null
  messageId: string | null
  summary: string | null
  errorMessage: string | null
  toolCallsUsed: number
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  steps: AgentRunStep[]
}
