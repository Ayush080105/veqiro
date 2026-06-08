import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  researchTopicSchema,
  researchCompanySchema,
  trendingTopicsSchema,
  addCompetitorSchema,
  discoverCompetitorsSchema,
} from "./scout.schema.js";
import * as scoutService from "./scout.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgScout = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await scoutService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getScoutMessages = async (req: Request, res: Response) => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await scoutService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const researchTopic = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = researchTopicSchema.parse(req.body);
  const result = await scoutService.researchTopic(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const researchCompany = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = researchCompanySchema.parse(req.body);
  const result = await scoutService.researchCompany(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const trendingTopics = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = trendingTopicsSchema.parse(req.body);
  const result = await scoutService.trendingTopics(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// ── Competitor Watchlist ──────────────────────────────────────────────────────

export const getCompetitors = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await scoutService.listCompetitors(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const addCompetitor = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = addCompetitorSchema.parse(req.body);
  const result = await scoutService.addCompetitor(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const removeCompetitor = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  if (!id) throw new BadRequestError("Competitor ID is required");
  await scoutService.removeCompetitor(id, organizationId);
  res.status(StatusCodes.NO_CONTENT).send();
};

export const discoverCompetitors = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = discoverCompetitorsSchema.parse(req.body);
  const result = await scoutService.discoverCompetitors(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
