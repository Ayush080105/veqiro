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

/** One entry of ChatSyncResponse.tool_trace from apps/ai — a single tool the
 *  agent ran this turn, as shown in the chat UI's visible trace. */
export interface ToolTraceEntry {
  label: string;
  /** Integration slug when the call went out over MCP; null for native tools. */
  integration?: string | null;
  status: "ok" | "error" | "pending";
  detail?: string;
  durationMs?: number | null;
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
