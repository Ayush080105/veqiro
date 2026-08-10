import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { Agent, McpConnectionStatus, McpProvider } from "../../../prisma/generated/prisma/client.js";
import { aiService } from "../../common/utils/aiService.js";
import * as repo from "./mcp.repository.js";
import { getIntegrationBySlug, getIntegrationsByAgent, type AgentSlug, type IntegrationCatalogEntry } from "@repo/integrations-catalog";
import type { ConnectResult, McpConnectionRef, McpConnectionSummary } from "./mcp.types.js";
import type { McpProviderAdapter } from "./mcp.provider.js";
import { composioAdapter } from "./mcp.provider.composio.js";

const AGENT_ENUM_BY_SLUG: Record<AgentSlug, Agent> = {
  vega: Agent.VEGA,
  maya: Agent.MAYA,
  sage: Agent.SAGE,
  scout: Agent.SCOUT,
  rex: Agent.REX,
  lex: Agent.LEX,
};

const AGENT_SLUG_BY_ENUM: Record<Agent, AgentSlug> = {
  VEGA: "vega",
  MAYA: "maya",
  SAGE: "sage",
  SCOUT: "scout",
  REX: "rex",
  LEX: "lex",
};

const PROVIDER_ADAPTER_BY_ENUM: Record<McpProvider, McpProviderAdapter> = {
  COMPOSIO: composioAdapter,
};

const providerEnumForEntry = (_entry: IntegrationCatalogEntry): McpProvider =>
  McpProvider.COMPOSIO;

const getProviderAdapter = (entry: IntegrationCatalogEntry): McpProviderAdapter =>
  PROVIDER_ADAPTER_BY_ENUM[providerEnumForEntry(entry)];

const toolkitSlugForEntry = (entry: IntegrationCatalogEntry): string =>
  entry.composio!.toolkitSlug;

const requireCatalogEntry = (slug: string): IntegrationCatalogEntry => {
  const entry = getIntegrationBySlug(slug);
  if (!entry) throw new NotFoundError(`Unknown integration "${slug}"`);
  if (entry.status !== "composio") {
    throw new BadRequestError(`"${entry.name}" isn't connectable yet — coming soon.`);
  }
  return entry;
};

const notifyAiCacheInvalidate = async (organizationId: string): Promise<void> => {
  try {
    await aiService.post("/ai/mcp/invalidate-cache", { organization_id: organizationId });
  } catch (err) {
    // Best-effort — worst case the AI service's tool-list cache serves a
    // stale view for up to its TTL, not a hard failure.
    console.error("[mcp] ai cache invalidation failed (continuing)", err);
  }
};

export const listConnections = async (organizationId: string): Promise<McpConnectionSummary[]> => {
  const rows = await repo.findByOrg(organizationId);
  return rows.map((row) => ({
    slug: row.integrationSlug,
    connectionId: row.connectionId,
    toolkitSlug: row.toolkitSlug,
    ownerAgent: row.ownerAgent,
    status: row.status,
    lastConnectedAt: row.lastConnectedAt,
    lastError: row.lastError,
  }));
};

export const getConfigSchema = async (slug: string) => {
  const entry = requireCatalogEntry(slug);
  return getProviderAdapter(entry).getConfigSchema(entry);
};

export interface ConnectArgs {
  organizationId: string;
  userId: string;
  slug: string;
  configValues?: Record<string, unknown>;
}

export const connect = async ({ organizationId, userId, slug, configValues }: ConnectArgs): Promise<ConnectResult> => {
  const entry = requireCatalogEntry(slug);
  const adapter = getProviderAdapter(entry);
  const provider = providerEnumForEntry(entry);
  const toolkitSlug = toolkitSlugForEntry(entry);
  const existing = await repo.findByOrgAndSlug(organizationId, slug);

  try {
    const result = await adapter.connect({
      entry,
      organizationId,
      existingConnectionId: existing?.connectionId,
      configValues,
    });

    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      connectionId: result.connectionId,
      toolkitSlug,
      provider,
      ownerAgent: AGENT_ENUM_BY_SLUG[entry.primaryAgent],
      status: result.dbStatus,
      connectedByUserId: userId,
      lastError: result.dbStatus === McpConnectionStatus.ERROR ? (result.message ?? "Connection failed") : null,
    });

    if (result.apiStatus === "connected") {
      await notifyAiCacheInvalidate(organizationId);
    }
    return { status: result.apiStatus, setupUrl: result.setupUrl, message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      // No provider connectionId was returned — reuse any existing row's id,
      // or synthesize a placeholder so the unique constraint still upserts.
      connectionId: existing?.connectionId ?? `failed_${crypto.randomUUID()}`,
      toolkitSlug,
      provider,
      ownerAgent: AGENT_ENUM_BY_SLUG[entry.primaryAgent],
      status: McpConnectionStatus.ERROR,
      connectedByUserId: userId,
      lastError: message,
    });
    return { status: "error", message };
  }
};

export const refreshStatus = async (organizationId: string, slug: string): Promise<McpConnectionSummary> => {
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("No connection found for this integration");

  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  const { dbStatus, lastError } = await adapter.refreshStatus(row.connectionId);
  const updated = await repo.updateStatus(organizationId, slug, { status: dbStatus, lastError: lastError ?? null });

  if (dbStatus === McpConnectionStatus.CONNECTED && row.status !== McpConnectionStatus.CONNECTED) {
    await notifyAiCacheInvalidate(organizationId);
  }

  return {
    slug: updated.integrationSlug,
    connectionId: updated.connectionId,
    toolkitSlug: updated.toolkitSlug,
    ownerAgent: updated.ownerAgent,
    status: updated.status,
    lastConnectedAt: updated.lastConnectedAt,
    lastError: updated.lastError,
  };
};

export const disconnect = async (organizationId: string, slug: string): Promise<void> => {
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("No connection found for this integration");

  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  try {
    await adapter.disconnect(row.connectionId);
  } catch (err) {
    console.error(`[mcp] ${row.provider.toLowerCase()} disconnect failed (continuing)`, err);
  }
  await repo.remove(organizationId, slug);
  await notifyAiCacheInvalidate(organizationId);
};

/**
 * Called by contextService.ts's callAgentWithContext() before every agent
 * turn — resolves which of the org's CONNECTED integrations this agent can
 * use. Cheap no-op (no provider call) when the org has zero connections.
 * Provider-blind by design — apps/ai never needs to know which provider
 * backs a connection.
 */
export const getConnectionsForAgent = async (
  organizationId: string,
  agentEnum: Agent
): Promise<McpConnectionRef[]> => {
  const rows = await repo.findConnectedByOrg(organizationId);
  if (rows.length === 0) return [];

  const agentSlug = AGENT_SLUG_BY_ENUM[agentEnum];
  const ownedSlugs = new Set(getIntegrationsByAgent(agentSlug).map((e) => e.slug));

  return rows
    .filter((row) => ownedSlugs.has(row.integrationSlug))
    .map((row) => ({
      connectionId: row.connectionId,
      toolkitSlug: row.toolkitSlug,
      integrationSlug: row.integrationSlug,
    }));
};

/**
 * Internal (apps/ai) — list tools for one connection. Node holds the
 * provider's master key exclusively; Python never talks to Composio
 * directly.
 */
export const listToolsForConnection = async (organizationId: string, connectionId: string) => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    // Never leak whether a connectionId exists for a DIFFERENT org.
    throw new NotFoundError("Connection not found");
  }
  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  return adapter.listTools({ toolkitSlug: row.toolkitSlug, connectionId });
};

/**
 * Internal (apps/ai) — call one tool on one connection. `connectionId` must
 * belong to `organizationId` — this is the enforced tenancy boundary: apps/ai
 * never talks to a provider directly or supplies a connectionId Node hasn't
 * already verified against this org.
 */
export const callTool = async (
  organizationId: string,
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>
) => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Connection not found");
  }
  const adapter = PROVIDER_ADAPTER_BY_ENUM[row.provider];
  return adapter.callTool({ organizationId, connectionId, toolkitSlug: row.toolkitSlug, toolName, args });
};
