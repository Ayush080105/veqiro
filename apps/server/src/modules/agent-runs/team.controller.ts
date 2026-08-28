import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import * as teamService from "./team.service.js";

const requireAuth = (req: Request) => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const sendSchema = z.object({ content: z.string().trim().min(1).max(8000) });
const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().optional(),
});

export const getTeam = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(await teamService.getTeamMembers(organizationId));
};

export const getTeamMessages = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { limit, before } = historySchema.parse(req.query);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(
    await teamService.getMessages(organizationId, limit, before),
  );
};

export const postTeamMessage = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuth(req);
  const { content } = sendSchema.parse(req.body);
  const message = await teamService.sendMessage(userId, organizationId, content);
  res.status(StatusCodes.OK).json(message);
};
