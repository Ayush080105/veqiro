import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { sendMessageSchema } from "./vega.schema.js";
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
  const before = req.query.before as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const messages = await vegaService.listMessages(organizationId, { before, limit });
  res.status(StatusCodes.OK).json(messages);
};
