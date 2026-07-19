import { prisma } from "../../config/prisma.js";
import { Prisma, Agent, McpConnectionStatus } from "../../../prisma/generated/prisma/client.js";

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

export interface UpsertInput {
  organizationId: string;
  integrationSlug: string;
  connectionId: string;
  qualifiedName: string;
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
      qualifiedName: input.qualifiedName,
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
      qualifiedName: input.qualifiedName,
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
