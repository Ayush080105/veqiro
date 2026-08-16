import type {
  Agent,
  McpConnection,
  McpConnectionStatus,
  McpPendingActionStatus,
} from "../../../prisma/generated/prisma/client.js";
import type { AgentSlug } from "@repo/integrations-catalog";

export type { McpConnection, McpConnectionStatus, McpPendingActionStatus };

export interface ConnectResult {
  status: "connected" | "auth_required" | "input_required" | "error";
  setupUrl?: string;
  message?: string;
}

export interface McpConnectionSummary {
  slug: string;
  connectionId: string;
  toolkitSlug: string;
  ownerAgent: Agent;
  status: McpConnectionStatus;
  lastConnectedAt: Date | null;
  lastError: string | null;
}

/** What contextService.ts's callAgentWithContext() merges into agent request metadata. */
export interface McpConnectionRef {
  connectionId: string;
  toolkitSlug: string;
  integrationSlug: string;
}

export type { AgentSlug };

/** One entry of ChatSyncResponse.metadata.pending_actions from apps/ai. */
export interface RawPendingAction {
  id: string;
  connection_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  summary: string;
}

export interface McpPendingActionSummary {
  id: string;
  agent: Agent;
  integrationSlug: string;
  toolName: string;
  summary: string;
  status: McpPendingActionStatus;
  resultJson: unknown;
  errorMessage: string | null;
}
