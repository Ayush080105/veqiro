import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { discoverCompetitorsSchema } from "./scout.schema.js";
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
  const result = await scoutService.sendMessage(userId, organizationId, req.body);
  res.status(StatusCodes.OK).json(result);
};

export const msgScoutStream = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let clientClosed = false;
  res.on("close", () => {
    clientClosed = true;
  });

  try {
    for await (const evt of scoutService.streamMessage(userId, organizationId, req.body)) {
      if (clientClosed) break;
      res.write(`event: ${evt.event}\ndata: ${evt.data}\n\n`);
    }
  } catch (err) {
    if (!clientClosed) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`event: error\ndata: ${JSON.stringify({ message, code: "server_error" })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
};

export const getScoutMessages = async (req: Request, res: Response) => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const before = req.query.before as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const messages = await scoutService.listMessages(organizationId, { before, limit });
  res.status(StatusCodes.OK).json(messages);
};

export const researchTopic = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const result = await scoutService.researchTopic(userId, organizationId, req.body);
  res.status(StatusCodes.OK).json(result);
};

export const researchCompany = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const result = await scoutService.researchCompany(userId, organizationId, req.body);
  res.status(StatusCodes.OK).json(result);
};

export const trendingTopics = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const result = await scoutService.trendingTopics(userId, organizationId, req.body);
  res.status(StatusCodes.OK).json(result);
};

export const discoverCompetitors = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = discoverCompetitorsSchema.parse(req.body);
  const result = await scoutService.discoverCompetitors(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
