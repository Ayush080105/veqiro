import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { NotFoundError } from "../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { McpPendingActionStatus } from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { listActivityEvents } from "../activity/activity-event.service.js";
import * as insightsService from "./insights.service.js";
import * as handoffsService from "./handoffs.service.js";
import * as workspaceService from "./workspace.service.js";
import { reindexAll, reindexKind } from "./reindex.js";
import {
  AGENT_BY_SLUG,
  activityQuerySchema,
  agentSlugParamSchema,
  createHandoffBodySchema,
  handoffIdParamSchema,
  handoffsQuerySchema,
  insightIdParamSchema,
  insightStatusBodySchema,
  insightsQuerySchema,
  memoryItemBodySchema,
  memoryItemIdParamSchema,
  reindexBodySchema,
  workQuerySchema,
} from "./workspace.schema.js";

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

/** The :agent param, already validated by entitlementForAgentParam upstream. */
const requireAgent = (req: Request) =>
  AGENT_BY_SLUG[agentSlugParamSchema.parse(req.params).agent];

export const getOverview = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const overview = await workspaceService.getOverview({
    organizationId,
    agent: requireAgent(req),
  });
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(overview);
};

/**
 * The company-wide pulse. Not agent-scoped: it is the one read that spans
 * every employee, which is the whole point of it.
 */
export const getPulse = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const pulse = await workspaceService.getCompanyPulse(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(pulse);
};

export const getActivity = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const query = activityQuerySchema.parse(req.query);
  const result = await listActivityEvents({
    organizationId,
    agent: requireAgent(req),
    ...query,
  });
  res.status(StatusCodes.OK).json(result);
};

export const getInsights = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const query = insightsQuerySchema.parse(req.query);
  const insights = await insightsService.listInsights({
    organizationId,
    agent: requireAgent(req),
    ...query,
  });
  res.status(StatusCodes.OK).json(insights);
};

export const patchInsight = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = insightIdParamSchema.parse(req.params);
  const { status } = insightStatusBodySchema.parse(req.body);
  const insight = await insightsService.setInsightStatus({ organizationId, id, status, userId });
  res.status(StatusCodes.OK).json(insight);
};

export const getWork = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const query = workQuerySchema.parse(req.query);
  const result = await workspaceService.listWorkObjects({
    organizationId,
    agent: requireAgent(req),
    ...query,
  });
  res.status(StatusCodes.OK).json(result);
};

export const getHandoffs = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const query = handoffsQuerySchema.parse(req.query);
  const handoffs = await handoffsService.listHandoffs({
    organizationId,
    agent: requireAgent(req),
    ...query,
  });
  res.status(StatusCodes.OK).json(handoffs);
};

export const postHandoff = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const body = createHandoffBodySchema.parse(req.body);
  const handoff = await handoffsService.createHandoff({ organizationId, userId, ...body });
  res.status(StatusCodes.CREATED).json(handoff);
};

export const patchHandoffStatus =
  (status: handoffsService.HandoffStatus) => async (req: Request, res: Response) => {
    const { organizationId } = requireAuth(req);
    const { id } = handoffIdParamSchema.parse(req.params);
    const handoff = await handoffsService.setHandoffStatus({ organizationId, id, status });
    res.status(StatusCodes.OK).json(handoff);
  };

export const getApprovals = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const rows = await prisma.mcpPendingAction.findMany({
    where: {
      organizationId,
      agent: requireAgent(req),
      status: McpPendingActionStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      agent: r.agent,
      integrationSlug: r.integrationSlug,
      toolName: r.toolName,
      actionId: r.actionId,
      summary: r.summary,
      arguments: r.arguments,
      objectKind: r.objectKind,
      objectId: r.objectId,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
  );
};

export const getMemory = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const agent = requireAgent(req);
  const [memory, org, items] = await Promise.all([
    prisma.agentMemory.findUnique({
      where: { organizationId_agent: { organizationId, agent } },
    }),
    prisma.orgMemory.findUnique({ where: { organizationId } }),
    // Company-wide items (agent null) come back too: they are context this
    // employee works from, and hiding them here would make the page look like
    // the agent knows less than it does.
    prisma.memoryItem.findMany({
      where: { organizationId, retiredAt: null, OR: [{ agent }, { agent: null }] },
      orderBy: [{ confirmed: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  res.status(StatusCodes.OK).json({
    agent,
    runningSummary: memory?.runningSummary ?? "",
    longTermFacts: memory?.longTermFacts ?? [],
    messageCount: memory?.messageCount ?? 0,
    org: {
      runningSummary: org?.runningSummary ?? "",
      longTermFacts: org?.longTermFacts ?? [],
    },
    items: items.map((item) => ({
      id: item.id,
      agent: item.agent,
      kind: item.kind,
      content: item.content,
      origin: item.origin,
      confirmed: item.confirmed,
      sourceKind: item.sourceKind,
      sourceId: item.sourceId,
      createdAt: item.createdAt.toISOString(),
    })),
  });
};

/**
 * Internal-only index rebuild. The escape hatch for projection drift; see
 * work-objects.projector.ts.
 */
export const postReindex = async (req: Request, res: Response) => {
  const { kind, organizationId } = reindexBodySchema.parse(req.body);
  // "*" rebuilds every kind — the blunt option, for when drift is suspected
  // broadly rather than in one place.
  const result =
    kind === "*"
      ? await reindexAll(organizationId)
      : await reindexKind(kind, organizationId);
  console.log("[work-objects] reindex", result);
  res.status(StatusCodes.OK).json(result);
};

/**
 * Confirm or retire one remembered fact.
 *
 * Retiring sets a timestamp rather than deleting: an agent should be able to
 * stop believing something without the record of it having believed it
 * disappearing, which is the difference between correcting a mistake and
 * pretending it never happened.
 */
export const patchMemoryItem = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = memoryItemIdParamSchema.parse(req.params);
  const { confirmed, retired } = memoryItemBodySchema.parse(req.body);

  const existing = await prisma.memoryItem.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError("Memory item not found");
  }

  const row = await prisma.memoryItem.update({
    where: { id },
    data: {
      ...(confirmed !== undefined
        ? {
            confirmed,
            confirmedAt: confirmed ? new Date() : null,
            confirmedByUserId: confirmed ? userId : null,
          }
        : {}),
      ...(retired !== undefined ? { retiredAt: retired ? new Date() : null } : {}),
    },
  });

  res.status(StatusCodes.OK).json({
    id: row.id,
    confirmed: row.confirmed,
    retired: row.retiredAt !== null,
  });
};
