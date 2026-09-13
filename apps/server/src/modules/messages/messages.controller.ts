import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import * as messagesService from "./messages.service.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { BadRequestError } from "../../common/errors/badRequest.js";

export const getLastMessages = async (req: Request, res: Response) => {
  if (!req.organizationId) {
    throw new UnauthenticatedError("Missing organization context");
  }
  const data = await messagesService.getLastMessages(req.organizationId);
  res.status(StatusCodes.OK).json(data);
};

const requireOrgContext = (req: Request): string => {
  if (!req.organizationId) throw new UnauthenticatedError("Missing organization context");
  return req.organizationId;
};

const pinBodySchema = z.object({ pinned: z.boolean() });

export const setMessagePinned = async (req: Request, res: Response) => {
  const organizationId = requireOrgContext(req);
  const { id } = req.params as { id: string };
  if (!id) throw new BadRequestError("Message id is required");
  const { pinned } = pinBodySchema.parse(req.body);
  const message = await messagesService.togglePin(id, organizationId, pinned);
  res.status(StatusCodes.OK).json(message);
};

export const getPinnedMessages = async (req: Request, res: Response) => {
  const organizationId = requireOrgContext(req);
  const agent = messagesService.parseAgentSlug(req.query.agent);
  const data = await messagesService.listPinnedMessages(organizationId, agent);
  res.status(StatusCodes.OK).json(data);
};

export const searchMessages = async (req: Request, res: Response) => {
  const organizationId = requireOrgContext(req);
  const agent = messagesService.parseAgentSlug(req.query.agent);
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const data = await messagesService.searchMessages(organizationId, agent, query);
  res.status(StatusCodes.OK).json(data);
};
