import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { McpPendingActionStatus } from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { listActivityEvents } from "../activity/activity-event.service.js";
import * as insightsService from "./insights.service.js";
import * as handoffsService from "./handoffs.service.js";
import * as workspaceService from "./workspace.service.js";
import { reindexKind } from "./work-objects.projector.js";
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
  const [memory, org] = await Promise.all([
    prisma.agentMemory.findUnique({
      where: { organizationId_agent: { organizationId, agent } },
    }),
    prisma.orgMemory.findUnique({ where: { organizationId } }),
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
  });
};

/**
 * Internal-only index rebuild. The escape hatch for projection drift; see
 * work-objects.projector.ts.
 */
export const postReindex = async (req: Request, res: Response) => {
  const { kind, organizationId } = reindexBodySchema.parse(req.body);
  const result = await reindexKind(kind, organizationId);
  console.log("[work-objects] reindex", result);
  res.status(StatusCodes.OK).json(result);
};
