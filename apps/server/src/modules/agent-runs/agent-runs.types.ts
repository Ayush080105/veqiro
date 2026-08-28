import type {
  Agent,
  AgentRunStatus,
  AgentRunStepStatus,
  AgentRunTrigger,
} from "../../../prisma/generated/prisma/client.js";

/** One node of a plan as apps/ai's planner emits it. */
export interface PlanNodeInput {
  key: string;
  title: string;
  agent: Agent;
  intent: string;
  integrationSlug?: string | null;
  dependsOn: string[];
  isWrite: boolean;
  expectedScope?: string | null;
}

export interface CreateRunInput {
  organizationId: string;
  userId: string;
  agent: Agent;
  trigger?: AgentRunTrigger;
  requestText: string;
  /** Planned from the shared team thread rather than one agent's chat. */
  isTeam?: boolean;
  /** The trigger event that started it, so staged actions trace back to it. */
  triggerEventId?: string | null;
  goal: string;
  plannerMeta?: unknown;
  nodes: PlanNodeInput[];
  messageId?: string | null;
}

/** Shape returned to the client; the graph plus per-node live status. */
export interface RunStepView {
  id: string;
  key: string;
  seq: number;
  agent: Agent;
  title: string;
  intent: string;
  integrationSlug: string | null;
  isWrite: boolean;
  expectedScope: string | null;
  dependsOn: string[];
  status: AgentRunStepStatus;
  enabled: boolean;
  attempt: number;
  outputText: string | null;
  actionId: string | null;
  actionResult: unknown;
  /** Action this step paused on, for the user to review in its own form. */
  proposedActionId: string | null;
  /** Arguments the model proposed, used to prefill that form. */
  proposedArgs: unknown;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  pendingActions: {
    id: string;
    summary: string;
    status: string;
    toolName: string;
    integrationSlug: string;
  }[];
}

export interface RunView {
  id: string;
  agent: Agent;
  trigger: AgentRunTrigger;
  requestText: string;
  status: AgentRunStatus;
  goal: string;
  planVersion: number;
  /** "agent|integrationSlug" identities authorised at plan approval. */
  approvedWrites: string[];
  approvedAt: Date | null;
  messageId: string | null;
  summary: string | null;
  errorMessage: string | null;
  toolCallsUsed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  steps: RunStepView[];
}
