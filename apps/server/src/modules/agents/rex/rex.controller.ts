import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  sendMessageSchema,
  analyzeMetricsSchema,
  forecastSchema,
  financialAnalysisSchema,
  compileBriefingSchema,
  runwaySchema,
  unitEconomicsSchema,
  scenarioSchema,
  weeklyDigestSchema,
  investorUpdateSchema,
} from "./rex.schema.js";
import * as rexService from "./rex.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgRex = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await rexService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getRexMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await rexService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const analyzeMetrics = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = analyzeMetricsSchema.parse(req.body);
  const result = await rexService.analyzeMetrics(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const forecast = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = forecastSchema.parse(req.body);
  const result = await rexService.forecast(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const financialAnalysis = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = financialAnalysisSchema.parse(req.body);
  const result = await rexService.financialAnalysis(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const compileBriefing = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = compileBriefingSchema.parse(req.body);
  const result = await rexService.compileBriefing(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const runway = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = runwaySchema.parse(req.body);
  const result = await rexService.runway(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const unitEconomics = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = unitEconomicsSchema.parse(req.body);
  const result = await rexService.unitEconomics(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const scenario = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = scenarioSchema.parse(req.body);
  const result = await rexService.scenario(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const weeklyDigest = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = weeklyDigestSchema.parse(req.body);
  const result = await rexService.weeklyDigest(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const investorUpdate = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = investorUpdateSchema.parse(req.body);
  const result = await rexService.investorUpdate(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// ── Snapshot ─────────────────────────────────────────────────────────────────

export const getSnapshot = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.getSnapshot(organizationId);
  res.status(StatusCodes.OK).json(result);
};

// ── Pins ─────────────────────────────────────────────────────────────────────

const pinBodySchema = z.object({
  kind: z.string().min(1),
  payload: z.unknown(),
});

export const listPins = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.listPins(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const createPin = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { kind, payload } = pinBodySchema.parse(req.body);
  const result = await rexService.createPin(userId, organizationId, kind, payload);
  res.status(StatusCodes.CREATED).json(result);
};

export const deletePin = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string | undefined;
  if (!id) throw new BadRequestError("Pin id is required");
  await rexService.removePin(id, organizationId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// ── Settings ─────────────────────────────────────────────────────────────────

const settingsPatchSchema = z.object({
  weeklyDigestEnabled: z.boolean().optional(),
  weeklyDigestTimezone: z.string().optional(),
  weeklyDigestRecipients: z.array(z.string().email()).optional(),
});

export const getSettings = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.getSettings(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const patchSettings = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const patch = settingsPatchSchema.parse(req.body);
  const result = await rexService.patchSettings(organizationId, patch);
  res.status(StatusCodes.OK).json(result);
};

// ── Datasets ─────────────────────────────────────────────────────────────────

const parseDatasetBodySchema = z.object({ r2Key: z.string().min(1) });

const saveDatasetBodySchema = z.object({
  datasets: z.array(
    z.object({
      name: z.string().min(1),
      metricKey: z.string().min(1),
      period: z.enum(["daily", "weekly", "monthly", "quarterly"]),
      points: z.array(z.object({ date: z.string(), value: z.number() })),
      unit: z.string().nullable().optional(),
      sourceId: z.string().nullable().optional(),
    })
  ).min(1),
});

export const listDatasets = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.listDatasets(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const parseDataset = async (req: Request, res: Response) => {
  requireAuthContext(req);
  const { r2Key } = parseDatasetBodySchema.parse(req.body);
  const result = await rexService.parseDataset(r2Key);
  res.status(StatusCodes.OK).json(result);
};

export const saveDatasets = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { datasets } = saveDatasetBodySchema.parse(req.body);
  const result = await rexService.saveDatasets(userId, organizationId, datasets);
  res.status(StatusCodes.CREATED).json(result);
};

export const deleteDataset = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string | undefined;
  if (!id) throw new BadRequestError("Dataset id is required");
  await rexService.removeDataset(id, organizationId);
  res.status(StatusCodes.NO_CONTENT).send();
};
