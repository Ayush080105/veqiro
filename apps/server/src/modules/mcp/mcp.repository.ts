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
