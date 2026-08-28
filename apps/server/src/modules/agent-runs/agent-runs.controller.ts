import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import {
  runIdParamSchema,
  approveRunBodySchema,
  listRunsQuerySchema,
} from "./agent-runs.schema.js";
import * as runsService from "./agent-runs.service.js";

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

/** Polled while a run is live — must never be cached. */
export const getRun = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = runIdParamSchema.parse(req.params);
  const run = await runsService.getRun(organizationId, id);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(run);
};

export const listRuns = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { agent, limit } = listRunsQuerySchema.parse(req.query);
  const runs = await runsService.listRuns(organizationId, agent, limit);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(runs);
};

export const approveRun = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = runIdParamSchema.parse(req.params);
  const { disabledStepKeys } = approveRunBodySchema.parse(req.body ?? {});
  const result = await runsService.approvePlan(organizationId, userId, id, disabledStepKeys);
  res.status(StatusCodes.OK).json(result);
};

export const rejectRun = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = runIdParamSchema.parse(req.params);
  res.status(StatusCodes.OK).json(await runsService.rejectPlan(organizationId, id));
};

export const cancelRun = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = runIdParamSchema.parse(req.params);
  res.status(StatusCodes.OK).json(await runsService.cancelRun(organizationId, id));
};
