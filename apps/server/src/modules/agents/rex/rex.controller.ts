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
  varianceSchema,
  boardDeckSchema,
  ingestSchema,
  alertRuleSchema,
  queryDatasetSchema,
  analyzeDatasetSchema,
  generateDatasetReportSchema,
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
  const before = req.query.before as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const messages = await rexService.listMessages(organizationId, { before, limit });
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
  alertRules: z.array(alertRuleSchema).optional(),
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

const singleSheetSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  columnTypes: z.record(z.string(), z.enum(["date", "numeric", "categorical", "text"])),
});

const rawTableSchema = singleSheetSchema.extend({
  sheets: z.record(z.string(), singleSheetSchema).optional(),
}).optional();

const saveDatasetBodySchema = z.object({
  datasets: z.array(
    z.object({
      name: z.string().min(1),
      metricKey: z.string().min(1),
      period: z.enum(["daily", "weekly", "monthly", "quarterly"]),
      points: z.array(z.object({ date: z.string(), value: z.number() })),
      unit: z.string().nullable().optional(),
      sourceId: z.string().nullable().optional(),
      purpose: z.enum(["actual", "budget"]).optional(),
    })
  ).min(1),
  mapping: z
    .object({
      dateColumn: z.string(),
      valueColumns: z.array(z.object({ column: z.string(), metricKey: z.string() })),
    })
    .optional(),
  rawTable: rawTableSchema,
});

export const listDatasets = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.listDatasets(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const parseDataset = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { r2Key } = parseDatasetBodySchema.parse(req.body);
  const result = await rexService.parseDataset(organizationId, r2Key);
  res.status(StatusCodes.OK).json(result);
};

export const saveDatasets = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { datasets, mapping, rawTable } = saveDatasetBodySchema.parse(req.body);
  // Attach rawTable to each dataset's meta so query-dataset can access the full table
  const datasetsWithMeta = datasets.map((d) => ({
    ...d,
    meta: rawTable ? { rawTable } : undefined,
  }));
  const result = await rexService.saveDatasets(userId, organizationId, datasetsWithMeta, mapping);
  res.status(StatusCodes.CREATED).json(result);
};

// ── Query dataset (Ask REX about any uploaded CSV/Excel) ─────────────────────

export const queryDataset = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const datasetId = req.params["id"] as string | undefined;
  if (!datasetId) throw new BadRequestError("Dataset id is required");
  const input = queryDatasetSchema.parse(req.body);
  const result = await rexService.queryDataset(userId, organizationId, datasetId, input);
  res.status(StatusCodes.OK).json(result);
};

export const analyzeDataset = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const datasetId = req.params["id"] as string | undefined;
  if (!datasetId) throw new BadRequestError("Dataset id is required");
  analyzeDatasetSchema.parse(req.body);
  const result = await rexService.analyzeDataset(userId, organizationId, datasetId);
  res.status(StatusCodes.OK).json(result);
};

export const generateDatasetReport = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const datasetId = req.params["id"] as string | undefined;
  if (!datasetId) throw new BadRequestError("Dataset id is required");
  const { format } = generateDatasetReportSchema.parse(req.body);
  const result = await rexService.generateDatasetReport(userId, organizationId, datasetId, format);
  res.status(StatusCodes.OK).json(result);
};

export const deleteDataset = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string | undefined;
  if (!id) throw new BadRequestError("Dataset id is required");
  await rexService.removeDataset(id, organizationId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// ── Variance (C9) ──────────────────────────────────────────────────────────

export const variance = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = varianceSchema.parse(req.body);
  const result = await rexService.variance(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// ── Board deck (C5) ─────────────────────────────────────────────────────────

export const boardDeck = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = boardDeckSchema.parse(req.body);
  const result = await rexService.boardDeck(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// ── Webhook ingest (C3) ─────────────────────────────────────────────────────

export const generateApiKey = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.generateApiKey(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const revokeApiKey = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await rexService.revokeApiKey(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const ingest = async (req: Request, res: Response) => {
  const input = ingestSchema.parse(req.body);
  const result = await rexService.ingestPoint(input);
  res.status(StatusCodes.OK).json(result);
};

// ── Pin sharing (C10) ───────────────────────────────────────────────────────

const sharePinSchema = z.object({ isPublic: z.boolean() });

export const sharePin = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = req.params["id"] as string | undefined;
  if (!id) throw new BadRequestError("Pin id is required");
  const { isPublic } = sharePinSchema.parse(req.body);
  const result = await rexService.sharePin(id, organizationId, isPublic);
  res.status(StatusCodes.OK).json(result);
};

export const getSharedPin = async (req: Request, res: Response) => {
  const token = req.params["token"] as string | undefined;
  if (!token) throw new BadRequestError("Share token is required");
  const result = await rexService.getSharedPin(token);
  if (!result) {
    res.status(StatusCodes.NOT_FOUND).json({ error: "Shared card not found or no longer public" });
    return;
  }
  res.status(StatusCodes.OK).json(result);
};
