import { randomBytes } from "node:crypto";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { Agent, McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";
import { smitheryClient, SMITHERY_NAMESPACE } from "../../lib/smithery.js";
import { aiService } from "../../common/utils/aiService.js";
import * as repo from "./mcp.repository.js";
import { getIntegrationBySlug, getIntegrationsByAgent, type AgentSlug } from "@repo/integrations-catalog";
import type { ConnectResult, McpConnectionRef, McpConnectionSummary } from "./mcp.types.js";

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

const base64url = (input: Buffer): string =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const generateConnectionId = (): string => `mc_${base64url(randomBytes(9))}`;

const requireCatalogEntry = (slug: string) => {
  const entry = getIntegrationBySlug(slug);
  if (!entry) throw new NotFoundError(`Unknown integration "${slug}"`);
  if (entry.status !== "smithery" || !entry.smithery) {
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

const mapConnectionStatus = (state: string | undefined): McpConnectionStatus => {
  switch (state) {
    case "connected":
      return McpConnectionStatus.CONNECTED;
    case "auth_required":
      return McpConnectionStatus.AUTH_REQUIRED;
    case "input_required":
      return McpConnectionStatus.AUTH_REQUIRED;
    case "error":
      return McpConnectionStatus.ERROR;
    case "disconnected":
      return McpConnectionStatus.DISCONNECTED;
    default:
      return McpConnectionStatus.PENDING;
  }
};

export const listConnections = async (organizationId: string): Promise<McpConnectionSummary[]> => {
  const rows = await repo.findByOrg(organizationId);
  return rows.map((row) => ({
    slug: row.integrationSlug,
    connectionId: row.connectionId,
    qualifiedName: row.qualifiedName,
    ownerAgent: row.ownerAgent,
    status: row.status,
    lastConnectedAt: row.lastConnectedAt,
    lastError: row.lastError,
  }));
};

export const getConfigSchema = async (slug: string) => {
  const entry = requireCatalogEntry(slug);
  const server = await smitheryClient.servers.get(entry.smithery!.qualifiedName);
  const httpConnection = server.connections.find((c) => c.type === "http");
  return httpConnection?.configSchema ?? {};
};

export interface ConnectArgs {
  organizationId: string;
  userId: string;
  slug: string;
  configValues?: Record<string, unknown>;
}

export const connect = async ({ organizationId, userId, slug, configValues }: ConnectArgs): Promise<ConnectResult> => {
  const entry = requireCatalogEntry(slug);

  const existing = await repo.findByOrgAndSlug(organizationId, slug);
  const connectionId = existing?.connectionId ?? generateConnectionId();

  try {
    const connection = await smitheryClient.connections.set(connectionId, {
      namespace: SMITHERY_NAMESPACE,
      server: entry.smithery!.qualifiedName,
      // Smithery's config schema tells each field apart as a header or query
      // param via its own x-from metadata — we pass everything as headers,
      // which Smithery Connect accepts for both; query-only fields are rare
      // and can be special-cased once the registry audit surfaces one.
      headers: configValues as Record<string, string> | undefined,
      metadata: { organizationId, integrationSlug: slug },
    });

    const status = mapConnectionStatus(connection.status?.state);

    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      connectionId,
      qualifiedName: entry.smithery!.qualifiedName,
      ownerAgent: AGENT_ENUM_BY_SLUG[entry.primaryAgent],
      status,
      connectedByUserId: userId,
      lastError: connection.status?.state === "error" ? connection.status.message : null,
    });

    if (connection.status?.state === "auth_required" || connection.status?.state === "input_required") {
      return {
        status: connection.status.state,
        setupUrl: connection.status.setupUrl,
      };
    }
    if (connection.status?.state === "error") {
      return { status: "error", message: connection.status.message };
    }
    await notifyAiCacheInvalidate(organizationId);
    return { status: "connected" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repo.upsert({
      organizationId,
      integrationSlug: slug,
      connectionId,
      qualifiedName: entry.smithery!.qualifiedName,
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

  const connection = await smitheryClient.connections.get(row.connectionId, { namespace: SMITHERY_NAMESPACE });
  const status = mapConnectionStatus(connection.status?.state);
  const updated = await repo.updateStatus(organizationId, slug, {
    status,
    lastError: connection.status?.state === "error" ? connection.status.message : null,
  });

  if (status === McpConnectionStatus.CONNECTED && row.status !== McpConnectionStatus.CONNECTED) {
    await notifyAiCacheInvalidate(organizationId);
  }

  return {
    slug: updated.integrationSlug,
    connectionId: updated.connectionId,
    qualifiedName: updated.qualifiedName,
    ownerAgent: updated.ownerAgent,
    status: updated.status,
    lastConnectedAt: updated.lastConnectedAt,
    lastError: updated.lastError,
  };
};

export const disconnect = async (organizationId: string, slug: string): Promise<void> => {
  const row = await repo.findByOrgAndSlug(organizationId, slug);
  if (!row) throw new NotFoundError("No connection found for this integration");

  try {
    await smitheryClient.connections.delete(row.connectionId, { namespace: SMITHERY_NAMESPACE });
  } catch (err) {
    console.error("[mcp] smithery disconnect failed (continuing)", err);
  }
  await repo.remove(organizationId, slug);
  await notifyAiCacheInvalidate(organizationId);
};

/**
 * Called by contextService.ts's callAgentWithContext() before every agent
 * turn — resolves which of the org's CONNECTED integrations this agent can
 * use. Cheap no-op (no Smithery call) when the org has zero connections.
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
      qualifiedName: row.qualifiedName,
      integrationSlug: row.integrationSlug,
    }));
};

/**
 * Internal (apps/ai) — list tools for one connection. Node holds the
 * Smithery master key exclusively; Python never talks to Smithery directly.
 */
export const listToolsForConnection = async (organizationId: string, connectionId: string) => {
  const row = await repo.findByConnectionId(connectionId);
  if (!row || row.organizationId !== organizationId) {
    // Never leak whether a connectionId exists for a DIFFERENT org.
    throw new NotFoundError("Connection not found");
  }
  const result = await smitheryClient.connections.tools.list(connectionId, { namespace: SMITHERY_NAMESPACE });
  return result.tools;
};

/**
 * Internal (apps/ai) — call one tool on one connection. `connectionId` must
 * belong to `organizationId` — this is the enforced tenancy boundary (see
 * plan risk #5: apps/ai never talks to Smithery directly or supplies a
 * connectionId Node hasn't already verified against this org).
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
  return smitheryClient.connections.tools.call(toolName, {
    namespace: SMITHERY_NAMESPACE,
    connectionId,
    body: args,
  });
};
