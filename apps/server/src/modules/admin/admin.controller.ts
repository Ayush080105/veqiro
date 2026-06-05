import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as repo from "./admin.repository.js";

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
  const data = await repo.getOrganizationById(req.params.id);
  res.status(StatusCodes.OK).json(data);
};

export const extendTrial = async (req: Request, res: Response) => {
  const data = await repo.extendTrial(req.params.id);
  res.status(StatusCodes.OK).json(data);
};
