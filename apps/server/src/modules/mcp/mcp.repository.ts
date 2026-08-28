import { prisma } from "../../config/prisma.js";
import {
  Prisma,
  Agent,
  McpConnectionStatus,
  McpProvider,
  McpPendingActionStatus,
  McpActionSource,
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
  /** Null for actions with no originating message — triggers, and steps of an
   *  unattended run. The column is nullable; this type used to be stricter
   *  than the schema. */
  messageId?: string | null;
  connectionId: string;
  integrationSlug: string;
  toolName: string;
  arguments: Record<string, unknown>;
  summary: string;
  /** Defaults to CHAT — only trigger-originated actions pass this. */
  source?: McpActionSource;
  triggerEventId?: string;
  /** Links the action to the run step that proposed it. */
  runStepId?: string;
}

export const createPendingActions = (rows: CreatePendingActionInput[]) =>
  prisma.mcpPendingAction.createMany({
    data: rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId,
      agent: r.agent,
      messageId: r.messageId ?? null,
      connectionId: r.connectionId,
      integrationSlug: r.integrationSlug,
      toolName: r.toolName,
      arguments: r.arguments as Prisma.InputJsonValue,
      summary: r.summary,
      source: r.source ?? McpActionSource.CHAT,
      triggerEventId: r.triggerEventId ?? null,
      runStepId: r.runStepId ?? null,
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

/**
 * One page of the customer-facing audit log, newest first. Cursor-paged on
 * (createdAt, id) rather than offset: the log is append-heavy, and an offset
 * page 2 read a minute later silently skips rows that arrived in between.
 */
export const findActionLog = (params: {
  organizationId: string;
  integrationSlug?: string;
  agent?: Agent;
  writesOnly?: boolean;
  failuresOnly?: boolean;
  before?: Date;
  limit: number;
}) =>
  prisma.mcpActionLog.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.integrationSlug ? { integrationSlug: params.integrationSlug } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
      ...(params.writesOnly ? { isWrite: true } : {}),
      ...(params.failuresOnly ? { successful: false } : {}),
      ...(params.before ? { createdAt: { lt: params.before } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.limit,
  });

/** Distinct integrations that appear in this org's log, for the filter list. */
export const findLoggedIntegrations = (organizationId: string) =>
  prisma.mcpActionLog.groupBy({
    by: ["integrationSlug"],
    where: { organizationId },
    _count: { _all: true },
  });

/** Successful provider calls since a moment — the Command Center's "agents did
 *  N things today" line, read from our own log rather than any provider. */
export const countRecentActions = (organizationId: string, since: Date) =>
  prisma.mcpActionLog.count({
    where: { organizationId, successful: true, createdAt: { gte: since } },
  });

// --- Tool catalog cache (shared across orgs; keyed by toolkit) -------------

export const findToolCatalog = (toolkitSlug: string) =>
  prisma.mcpToolCatalog.findUnique({ where: { toolkitSlug } });

export const upsertToolCatalog = (
  toolkitSlug: string,
  provider: McpProvider,
  tools: unknown,
) =>
  prisma.mcpToolCatalog.upsert({
    where: { toolkitSlug },
    create: {
      toolkitSlug,
      provider,
      tools: tools as Prisma.InputJsonValue,
      toolCount: Array.isArray(tools) ? tools.length : 0,
    },
    update: {
      tools: tools as Prisma.InputJsonValue,
      toolCount: Array.isArray(tools) ? tools.length : 0,
      fetchedAt: new Date(),
    },
  });

// --- Trigger catalog cache (shared across orgs; keyed by toolkit) ----------

export const findTriggerCatalog = (toolkitSlug: string) =>
  prisma.mcpTriggerCatalog.findUnique({ where: { toolkitSlug } });

export const upsertTriggerCatalog = (
  toolkitSlug: string,
  provider: McpProvider,
  triggers: unknown,
) =>
  prisma.mcpTriggerCatalog.upsert({
    where: { toolkitSlug },
    create: {
      toolkitSlug,
      provider,
      triggers: triggers as Prisma.InputJsonValue,
      triggerCount: Array.isArray(triggers) ? triggers.length : 0,
    },
    update: {
      triggers: triggers as Prisma.InputJsonValue,
      triggerCount: Array.isArray(triggers) ? triggers.length : 0,
      fetchedAt: new Date(),
    },
  });
