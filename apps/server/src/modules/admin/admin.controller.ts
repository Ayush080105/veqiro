import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as repo from "./admin.repository.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

const requireParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
};

export const getUsage = async (_req: Request, res: Response) => {
  const data = await repo.getUsageStats();
  res.status(StatusCodes.OK).json(data);
};

export const overview = async (_req: Request, res: Response) => {
  const data = await repo.getOverviewStats();
  res.status(StatusCodes.OK).json(data);
};

export const listOrgs = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const data = await repo.listOrganizations({
    search: q.search?.trim() || undefined,
    status: q.status || undefined,
    page: Number(q.page) || 1,
  });
  res.status(StatusCodes.OK).json(data);
};

export const getOrg = async (req: Request, res: Response) => {
  const data = await repo.getOrganizationById(requireParam(req.params.id));
  res.status(StatusCodes.OK).json(data);
};

export const extendTrial = async (req: Request, res: Response) => {
  const days = req.body?.days ? Number(req.body.days) : 7;
  const data = await repo.extendTrial(requireParam(req.params.id), days);
  res.status(StatusCodes.OK).json(data);
};

export const setSubscriptionStatus = async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  const data = await repo.setSubscriptionStatus(requireParam(req.params.id), status);
  res.status(StatusCodes.OK).json(data);
};

export const bulkExtendTrial = async (req: Request, res: Response) => {
  const { orgIds, days } = req.body as { orgIds: string[]; days?: number };
  const data = await repo.bulkExtendTrial(orgIds, days ?? 7);
  res.status(StatusCodes.OK).json(data);
};

export const grantCredits = async (req: Request, res: Response) => {
  const credits = Number(req.body?.credits);
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new BadRequestError("credits must be a positive integer");
  }
  const data = await repo.grantCredits(requireParam(req.params.id), credits);
  res.status(StatusCodes.OK).json(data);
};

export const getIntegrations = async (_req: Request, res: Response) => {
  const data = await repo.getIntegrationStats();
  res.status(StatusCodes.OK).json(data);
};

export const getAgents = async (_req: Request, res: Response) => {
  const data = await repo.getAgentAdoptionStats();
  res.status(StatusCodes.OK).json(data);
};

export const exportOrgs = async (_req: Request, res: Response) => {
  const csv = await repo.exportOrganizationsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=organizations.csv");
  res.status(StatusCodes.OK).send(csv);
};

export const exportUsers = async (_req: Request, res: Response) => {
  const csv = await repo.exportUsersCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=users.csv");
  res.status(StatusCodes.OK).send(csv);
};

export const verifyUserEmail = async (req: Request, res: Response) => {
  const data = await repo.verifyUserEmail(requireParam(req.params.id));
  res.status(StatusCodes.OK).json(data);
};

export const revokeUserSessions = async (req: Request, res: Response) => {
  const data = await repo.revokeUserSessions(requireParam(req.params.id));
  res.status(StatusCodes.OK).json(data);
};

export const deleteUser = async (req: Request, res: Response) => {
  const data = await repo.deleteUser(requireParam(req.params.id));
  res.status(StatusCodes.OK).json(data);
};

export const listUsers = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const isBannedFilter = q.filterField === "banned";
  const data = await repo.listUsers({
    search: (q.search ?? q.searchValue)?.trim() || undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
    page: q.page ? Number(q.page) : undefined,
    banned: isBannedFilter ? q.filterValue === "true" : undefined,
  });
  res.status(StatusCodes.OK).json(data);
};

export const listWaitlistEntries = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const data = await repo.listWaitlistEntries({
    cursor: q.cursor || undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    search: q.search?.trim() || undefined,
  });
  res.status(StatusCodes.OK).json(data);
};

export const listActivity = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const data = await repo.listActivity({
    cursor: q.cursor || undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    userId: q.userId || undefined,
    action: q.action as Parameters<typeof repo.listActivity>[0]["action"],
    search: q.search?.trim() || undefined,
  });
  res.status(StatusCodes.OK).json(data);
};

export const listFeedbackAdmin = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const data = await repo.listFeedbackAdmin({
    status: q.status as Parameters<typeof repo.listFeedbackAdmin>[0]["status"],
    category: q.category as Parameters<typeof repo.listFeedbackAdmin>[0]["category"],
    agentSlug: q.agentSlug || undefined,
    search: q.search?.trim() || undefined,
    page: q.page ? Number(q.page) : 1,
    limit: q.limit ? Number(q.limit) : 25,
  });
  res.status(StatusCodes.OK).json(data);
};

export const getFeedbackComments = async (req: Request, res: Response) => {
  const data = await repo.getFeedbackComments(requireParam(req.params.id));
  res.status(StatusCodes.OK).json(data);
};

export const getFeedbackStats = async (_req: Request, res: Response) => {
  const data = await repo.getFeedbackStats();
  res.status(StatusCodes.OK).json(data);
};

export const updateFeedbackStatusAdmin = async (req: Request, res: Response) => {
  const id = requireParam(req.params.id);
  const { status, adminReply, adminNote, roadmapEta } = req.body as {
    status: string;
    adminReply?: string | null;
    adminNote?: string | null;
    roadmapEta?: string | null;
  };
  const data = await repo.updateFeedbackStatusAdmin(id, {
    status: status as Parameters<typeof repo.updateFeedbackStatusAdmin>[1]["status"],
    adminReply,
    adminNote,
    roadmapEta,
  });
  res.status(StatusCodes.OK).json(data);
};

export const listUpcomingAgentsAdmin = async (_req: Request, res: Response) => {
  const data = await repo.listUpcomingAgentsAdmin();
  res.status(StatusCodes.OK).json(data);
};

export const createUpcomingAgentAdmin = async (req: Request, res: Response) => {
  const data = await repo.createUpcomingAgentAdmin(req.body as Parameters<typeof repo.createUpcomingAgentAdmin>[0]);
  res.status(StatusCodes.CREATED).json(data);
};

export const updateUpcomingAgentAdmin = async (req: Request, res: Response) => {
  const data = await repo.updateUpcomingAgentAdmin(requireParam(req.params.agentId), req.body as Parameters<typeof repo.updateUpcomingAgentAdmin>[1]);
  res.status(StatusCodes.OK).json(data);
};

export const deleteUpcomingAgentAdmin = async (req: Request, res: Response) => {
  await repo.deleteUpcomingAgentAdmin(requireParam(req.params.agentId));
  res.status(StatusCodes.NO_CONTENT).send();
};

