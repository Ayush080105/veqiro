import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  processInboxSchema,
  draftReplySchema,
  calendarSummarySchema,
  createEventSchema,
  executiveBriefingSchema,
  composeEmailSchema,
} from "./vega.schema.js";
import * as vegaService from "./vega.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgVega = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await vegaService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getVegaMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await vegaService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const processInbox = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = processInboxSchema.parse(req.body);
  const result = await vegaService.processInbox(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftReply = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftReplySchema.parse(req.body);
  const result = await vegaService.draftReply(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const calendarSummary = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = calendarSummarySchema.parse(req.body);
  const result = await vegaService.calendarSummary(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const createEvent = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = createEventSchema.parse(req.body);
  const result = await vegaService.createEvent(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const executiveBriefing = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = executiveBriefingSchema.parse(req.body);
  const result = await vegaService.executiveBriefing(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const composeEmail = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = composeEmailSchema.parse(req.body);
  const result = await vegaService.composeEmail(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
