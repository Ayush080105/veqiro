import { prisma } from "../../config/prisma.js";
import {
  Prisma,
  Agent,
  McpConnectionStatus,
  McpProvider,
  McpPendingActionStatus,
} from "../../../prisma/generated/prisma/client.js";

export const findByOrg = (organizationId: string) =>
  prisma.mcpConnection.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

export const findConnectedByOrg = (organizationId: string) =>
  prisma.mcpConnection.findMany({
    where: { organizationId, status: McpConnectionStatus.CONNECTED },
  });

export const findByOrgAndSlug = (organizationId: string, integrationSlug: string) =>
  prisma.mcpConnection.findUnique({
    where: { organizationId_integrationSlug: { organizationId, integrationSlug } },
  });

export const findByConnectionId = (connectionId: string) =>
  prisma.mcpConnection.findUnique({ where: { connectionId } });

export const findManyByConnectionIds = (organizationId: string, connectionIds: string[]) =>
  prisma.mcpConnection.findMany({
    where: { organizationId, connectionId: { in: connectionIds } },
  });

export interface UpsertInput {
  organizationId: string;
  integrationSlug: string;
  connectionId: string;
  toolkitSlug: string;
  provider: McpProvider;
  ownerAgent: Agent;
  status: McpConnectionStatus;
  configSchema?: Record<string, unknown> | null;
  lastError?: string | null;
  connectedByUserId?: string;
}

export const upsert = (input: UpsertInput) =>
  prisma.mcpConnection.upsert({
    where: {
      organizationId_integrationSlug: {
        organizationId: input.organizationId,
        integrationSlug: input.integrationSlug,
      },
    },
    create: {
      organizationId: input.organizationId,
      integrationSlug: input.integrationSlug,
      connectionId: input.connectionId,
      toolkitSlug: input.toolkitSlug,
      provider: input.provider,
      ownerAgent: input.ownerAgent,
      status: input.status,
      configSchema: (input.configSchema ?? undefined) as Prisma.InputJsonValue | undefined,
      lastError: input.lastError,
      connectedByUserId: input.connectedByUserId,
      lastConnectedAt: input.status === McpConnectionStatus.CONNECTED ? new Date() : undefined,
      lastCheckedAt: new Date(),
    },
    update: {
      connectionId: input.connectionId,
      toolkitSlug: input.toolkitSlug,
      provider: input.provider,
      status: input.status,
      configSchema: (input.configSchema ?? undefined) as Prisma.InputJsonValue | undefined,
      lastError: input.lastError ?? null,
      lastConnectedAt: input.status === McpConnectionStatus.CONNECTED ? new Date() : undefined,
      lastCheckedAt: new Date(),
    },
  });

export const updateStatus = (
  organizationId: string,
  integrationSlug: string,
  data: { status: McpConnectionStatus; lastError?: string | null }
) =>
  prisma.mcpConnection.update({
    where: { organizationId_integrationSlug: { organizationId, integrationSlug } },
    data: {
      status: data.status,
      lastError: data.lastError ?? null,
      lastCheckedAt: new Date(),
      lastConnectedAt: data.status === McpConnectionStatus.CONNECTED ? new Date() : undefined,
    },
  });

export const remove = (organizationId: string, integrationSlug: string) =>
  prisma.mcpConnection.delete({
    where: { organizationId_integrationSlug: { organizationId, integrationSlug } },
  });

// --- Pending MCP actions (write-capable tool calls awaiting confirmation) ---

export interface CreatePendingActionInput {
  id: string;
  organizationId: string;
  userId: string;
  agent: Agent;
  messageId: string;
  connectionId: string;
  integrationSlug: string;
  toolName: string;
  arguments: Record<string, unknown>;
  summary: string;
}

export const createPendingActions = (rows: CreatePendingActionInput[]) =>
  prisma.mcpPendingAction.createMany({
    data: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId,
      agent: r.agent,
      messageId: r.messageId,
      connectionId: r.connectionId,
      integrationSlug: r.integrationSlug,
      toolName: r.toolName,
      arguments: r.arguments as Prisma.InputJsonValue,
      summary: r.summary,
    })),
  });

/** Actions the agents staged but haven't been allowed to run yet — the
 *  "needs you" queue the Command Center leads with. */
export const findPendingActionsByOrg = (organizationId: string, limit: number) =>
  prisma.mcpPendingAction.findMany({
    where: { organizationId, status: McpPendingActionStatus.PENDING },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

export const countPendingActionsByOrg = (organizationId: string) =>
  prisma.mcpPendingAction.count({
    where: { organizationId, status: McpPendingActionStatus.PENDING },
  });

export const findPendingActionById = (id: string) =>
  prisma.mcpPendingAction.findUnique({ where: { id } });

export const updatePendingActionStatus = (
  id: string,
  data: { status: McpPendingActionStatus; resultJson?: unknown; errorMessage?: string | null }
) =>
  prisma.mcpPendingAction.update({
    where: { id },
    data: {
      status: data.status,
      resultJson: (data.resultJson ?? undefined) as Prisma.InputJsonValue | undefined,
      errorMessage: data.errorMessage ?? null,
    },
  });

// --- Per-agent MCP tool preference (which connected integration an agent's
// native tools should defer to, overriding their built-in default source) ---

export const findToolPreference = (organizationId: string, agent: Agent) =>
  prisma.mcpToolPreference.findUnique({
    where: { organizationId_agent: { organizationId, agent } },
  });

export const upsertToolPreference = (
  organizationId: string,
  agent: Agent,
  preferredIntegrationSlug: string | null
) =>
  prisma.mcpToolPreference.upsert({
    where: { organizationId_agent: { organizationId, agent } },
    create: { organizationId, agent, preferredIntegrationSlug },
    update: { preferredIntegrationSlug },
  });

/** Aggregates for the monthly value report. Counts only successful calls —
 *  a failed provider call is not work delivered, and inflating the headline
 *  with retries would make the report untrustworthy exactly where it matters. */
export const summarizeActions = async (organizationId: string, since: Date) => {
  const where = { organizationId, createdAt: { gte: since }, successful: true };
  const [total, writes, byIntegration] = await Promise.all([
    prisma.mcpActionLog.count({ where }),
    prisma.mcpActionLog.count({ where: { ...where, isWrite: true } }),
    prisma.mcpActionLog.groupBy({
      by: ["integrationSlug"],
      where,
      _count: { _all: true },
      orderBy: { _count: { integrationSlug: "desc" } },
    }),
  ]);
  return { total, writes, byIntegration };
};

// --- Dashboard tiles (widgets the org pinned to its Command Center) ---

export const findTilesByOrg = (organizationId: string) =>
  prisma.mcpDashboardTile.findMany({
    where: { organizationId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

export const createTile = (input: {
  organizationId: string;
  widgetId: string;
  integrationSlug: string;
  inputs?: Record<string, unknown> | null;
  label?: string | null;
  position: number;
}) =>
  prisma.mcpDashboardTile.create({
    data: {
      organizationId: input.organizationId,
      widgetId: input.widgetId,
      integrationSlug: input.integrationSlug,
      inputs: (input.inputs ?? undefined) as Prisma.InputJsonValue | undefined,
      label: input.label ?? null,
      position: input.position,
    },
  });

export const deleteTile = (organizationId: string, id: string) =>
  prisma.mcpDashboardTile.deleteMany({ where: { id, organizationId } });

export const countTilesByOrg = (organizationId: string) =>
  prisma.mcpDashboardTile.count({ where: { organizationId } });
