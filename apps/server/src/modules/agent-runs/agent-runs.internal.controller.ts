import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  internalRunParamsSchema,
  internalStepParamsSchema,
  updateStepBodySchema,
  heartbeatBodySchema,
  executeWriteBodySchema,
  finishRunBodySchema,
  addStepsBodySchema,
} from "./agent-runs.schema.js";
import * as internalService from "./agent-runs.internal.service.js";

/**
 * Called only by apps/ai, behind internalKeyMiddleware. Bodies on this path
 * are NOT camelized (see camelizeBody.middleware.ts) — the write endpoint
 * carries raw provider tool arguments.
 */

export const updateStep = async (req: Request, res: Response) => {
  const { id, key } = internalStepParamsSchema.parse(req.params);
  const fields = updateStepBodySchema.parse(req.body ?? {});
  await internalService.updateStep(id, key, fields);
  res.status(StatusCodes.OK).json({ ok: true });
};

export const heartbeat = async (req: Request, res: Response) => {
  const { id } = internalRunParamsSchema.parse(req.params);
  const { toolCallsUsed } = heartbeatBodySchema.parse(req.body ?? {});
  const result = await internalService.heartbeat(id, toolCallsUsed);
  res.status(StatusCodes.OK).json(result);
};

export const executeWrite = async (req: Request, res: Response) => {
  const { id, key } = internalStepParamsSchema.parse(req.params);
  const body = executeWriteBodySchema.parse(req.body ?? {});
  const result = await internalService.executeWrite(id, key, body);
  // A refused write is a valid outcome the executor acts on, not a transport
  // error — 200 with executed:false, so it is never retried as a 5xx.
  res.status(StatusCodes.OK).json(result);
};

export const finishRun = async (req: Request, res: Response) => {
  const { id } = internalRunParamsSchema.parse(req.params);
  const { status, summary, errorMessage } = finishRunBodySchema.parse(req.body ?? {});
  await internalService.finishRun(id, status, summary, errorMessage);
  res.status(StatusCodes.OK).json({ ok: true });
};

export const addSteps = async (req: Request, res: Response) => {
  const { id } = internalRunParamsSchema.parse(req.params);
  const { steps } = addStepsBodySchema.parse(req.body ?? {});
  await internalService.addSteps(id, steps);
  res.status(StatusCodes.OK).json({ ok: true });
};
