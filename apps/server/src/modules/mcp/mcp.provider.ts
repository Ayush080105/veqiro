import type { McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";
import type { IntegrationCatalogEntry } from "@repo/integrations-catalog";
import type { ConnectResult } from "./mcp.types.js";

/**
 * One adapter per MCP broker (Composio). mcp.service.ts stays
 * provider-blind orchestration (repo upserts, tenancy checks, AI cache
 * invalidation) and delegates the provider-specific API calls here.
 */
export interface McpProviderAdapter {
  getConfigSchema(entry: IntegrationCatalogEntry): Promise<Record<string, unknown>>;

  connect(args: {
    entry: IntegrationCatalogEntry;
    organizationId: string;
    existingConnectionId?: string;
    configValues?: Record<string, unknown>;
  }): Promise<{
    connectionId: string;
    dbStatus: McpConnectionStatus;
    apiStatus: ConnectResult["status"];
    setupUrl?: string;
    message?: string;
  }>;

  refreshStatus(connectionId: string): Promise<{ dbStatus: McpConnectionStatus; lastError?: string | null }>;

  disconnect(connectionId: string): Promise<void>;

  listTools(args: {
    toolkitSlug: string;
    connectionId: string;
  }): Promise<{ name: string; description?: string; inputSchema?: unknown }[]>;

  callTool(args: {
    organizationId: string;
    connectionId: string;
    toolkitSlug: string;
    toolName: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;
}
