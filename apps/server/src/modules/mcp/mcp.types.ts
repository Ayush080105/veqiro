import type { Agent, McpConnection, McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";
import type { AgentSlug } from "@repo/integrations-catalog";

export type { McpConnection, McpConnectionStatus };

export interface ConnectResult {
  status: "connected" | "auth_required" | "input_required" | "error";
  setupUrl?: string;
  message?: string;
}

export interface McpConnectionSummary {
  slug: string;
  connectionId: string;
  qualifiedName: string;
  ownerAgent: Agent;
  status: McpConnectionStatus;
  lastConnectedAt: Date | null;
  lastError: string | null;
}

/** What contextService.ts's callAgentWithContext() merges into agent request metadata. */
export interface McpConnectionRef {
  connectionId: string;
  qualifiedName: string;
  integrationSlug: string;
}

export type { AgentSlug };
