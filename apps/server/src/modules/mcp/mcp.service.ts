import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { Agent, McpConnectionStatus, McpPendingActionStatus, McpProvider } from "../../../prisma/generated/prisma/client.js";
import { aiService } from "../../common/utils/aiService.js";
import * as repo from "./mcp.repository.js";
import { getIntegrationBySlug, getIntegrationsByAgent, type AgentSlug, type IntegrationCatalogEntry } from "@repo/integrations-catalog";
import type {
  ConnectResult,
  McpConnectionRef,
  McpConnectionSummary,
  McpPendingActionSummary,
  RawPendingAction,
} from "./mcp.types.js";
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Best-effort extraction of a wait duration from a provider's rate-limit
// error text, e.g. Reddit's Composio error: "[['RATELIMIT', '5 seconds',
// 'ratelimit']]". Returns null when the message isn't rate-limit-shaped or
// no duration could be parsed, in which case the caller should not retry.
const parseRateLimitWaitMs = (message: string): number | null => {
  if (!/rate.?limit/i.test(message)) return null;
  const match = message.match(/(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("ms") || unit.startsWith("milli")) return value;
  if (unit.startsWith("m") && !unit.startsWith("ms") && !unit.startsWith("milli")) return value * 60_000;
  return value * 1000;
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

const toPendingActionSummary = (row: {
  id: string;
  agent: Agent;
  integrationSlug: string;
  toolName: string;
  summary: string;
  status: McpPendingActionStatus;
  resultJson: unknown;
  errorMessage: string | null;
}): McpPendingActionSummary => ({
  id: row.id,
  agent: row.agent,
  integrationSlug: row.integrationSlug,
  toolName: row.toolName,
  summary: row.summary,
  status: row.status,
  resultJson: row.resultJson,
  errorMessage: row.errorMessage,
});

/** Lightweight snapshot each agent's *.service.ts stores on Message.customInput
 * so the chat UI can render pending-action cards without an extra fetch. */
export const toPendingActionsSnapshot = (pendingActions: RawPendingAction[]) =>
  pendingActions.map((a) => ({ id: a.id, summary: a.summary, status: "PENDING" as const }));

/**
 * Called by each agent's *.service.ts right after it persists the assistant
 * Message — stages the write-capable MCP tool calls apps/ai proposed but did
 * NOT execute (see agents/base.py's mcp_pending_actions), so the user can
 * confirm or reject each one from the chat UI.
 */
export const stagePendingActions = async (params: {
  organizationId: string;
  userId: string;
  agent: Agent;
  messageId: string;
  pendingActions: RawPendingAction[];
}): Promise<void> => {
  if (params.pendingActions.length === 0) return;
  const connectionIds = [...new Set(params.pendingActions.map((a) => a.connection_id))];
  const connections = await repo.findManyByConnectionIds(params.organizationId, connectionIds);
  const integrationSlugByConnectionId = new Map(connections.map((c) => [c.connectionId, c.integrationSlug]));

  await repo.createPendingActions(
    params.pendingActions.map((a) => ({
      id: a.id,
      organizationId: params.organizationId,
      userId: params.userId,
      agent: params.agent,
      messageId: params.messageId,
      connectionId: a.connection_id,
      integrationSlug: integrationSlugByConnectionId.get(a.connection_id) ?? "",
      toolName: a.tool_name,
      arguments: a.arguments,
      summary: a.summary,
    }))
  );
};

const requirePendingAction = async (organizationId: string, id: string) => {
  const row = await repo.findPendingActionById(id);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Pending action not found");
  }
  if (row.status !== McpPendingActionStatus.PENDING) {
    throw new BadRequestError(`Action already ${row.status.toLowerCase()}`);
  }
  return row;
};

/**
 * Live status lookup — no PENDING guard, unlike confirm/reject. Lets the
 * frontend show the real current state on page load/refresh instead of the
 * stale PENDING snapshot baked into Message.customInput at staging time.
 */
export const getPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  const row = await repo.findPendingActionById(id);
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Pending action not found");
  }
  return toPendingActionSummary(row);
};

export const confirmPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  const row = await requirePendingAction(organizationId, id);
  const MAX_RATE_LIMIT_RETRIES = 2;
  const MAX_AUTO_WAIT_MS = 15_000; // don't hold the request open longer than this per wait

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await callTool(
        organizationId,
        row.connectionId,
        row.toolName,
        row.arguments as Record<string, unknown>
      );
      // Composio's tool.execute() often reports business-logic-level failures
      // (permission denied, plan limits, validation errors, rate limits, ...)
      // as a normal 200 response shaped { data, error, successful: false }
      // rather than throwing — verified live (Calendly's paid-plan-only
      // Scheduling API, Reddit's rate limiter both return this shape).
      const isComposioFailure =
        typeof result === "object" && result !== null && (result as { successful?: unknown }).successful === false;
      if (isComposioFailure) {
        const composioError = (result as { error?: unknown }).error;
        const errorMessage = typeof composioError === "string" ? composioError : "Action failed";
        const waitMs = parseRateLimitWaitMs(errorMessage);
        if (waitMs !== null && waitMs <= MAX_AUTO_WAIT_MS && attempt < MAX_RATE_LIMIT_RETRIES) {
          await sleep(waitMs);
          continue; // retry the same tool call
        }
        const updated = await repo.updatePendingActionStatus(id, {
          status: McpPendingActionStatus.FAILED,
          resultJson: result,
          errorMessage,
        });
        return toPendingActionSummary(updated);
      }
      const updated = await repo.updatePendingActionStatus(id, {
        status: McpPendingActionStatus.EXECUTED,
        resultJson: result,
      });
      return toPendingActionSummary(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated = await repo.updatePendingActionStatus(id, {
        status: McpPendingActionStatus.FAILED,
        errorMessage: message,
      });
      return toPendingActionSummary(updated);
    }
  }
};

export const rejectPendingAction = async (
  organizationId: string,
  id: string
): Promise<McpPendingActionSummary> => {
  await requirePendingAction(organizationId, id);
  const updated = await repo.updatePendingActionStatus(id, { status: McpPendingActionStatus.REJECTED });
  return toPendingActionSummary(updated);
};

// --- Per-agent MCP tool preference ---

const requireAgentSlug = (agentSlug: string): AgentSlug => {
  if (!(agentSlug in AGENT_ENUM_BY_SLUG)) {
    throw new BadRequestError(`Unknown agent "${agentSlug}"`);
  }
  return agentSlug as AgentSlug;
};

export const getToolPreference = async (
  organizationId: string,
  agentSlug: string
): Promise<{ preferredIntegrationSlug: string | null }> => {
  const agent = AGENT_ENUM_BY_SLUG[requireAgentSlug(agentSlug)];
  const row = await repo.findToolPreference(organizationId, agent);
  return { preferredIntegrationSlug: row?.preferredIntegrationSlug ?? null };
};

export const setToolPreference = async (
  organizationId: string,
  agentSlug: string,
  preferredIntegrationSlug: string | null
): Promise<{ preferredIntegrationSlug: string | null }> => {
  const agent = AGENT_ENUM_BY_SLUG[requireAgentSlug(agentSlug)];
  const row = await repo.upsertToolPreference(organizationId, agent, preferredIntegrationSlug);
  return { preferredIntegrationSlug: row.preferredIntegrationSlug };
};
