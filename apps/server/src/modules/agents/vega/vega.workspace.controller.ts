import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import {
  getInboxSchema,
  sendReplySchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
import * as ws from "./vega.workspace.service.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

// Inbox
export const getInbox = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getInboxSchema.parse(req.query);
  const result = await ws.getInbox(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const sendReply = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const emailId = req.params.emailId as string;
  if (!emailId) throw new BadRequestError("emailId param required");
  const input = sendReplySchema.parse(req.body);
  const result = await ws.sendReply(userId, organizationId, emailId, input);
  res.status(StatusCodes.OK).json(result);
};

// Follow-ups
export const getFollowUps = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await ws.getFollowUps(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const createFollowUp = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = createFollowUpSchema.parse(req.body);
  const result = await ws.createFollowUp(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const cancelFollowUp = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const followUpId = req.params.followUpId as string;
  if (!followUpId) throw new BadRequestError("followUpId param required");
  await ws.cancelFollowUp(organizationId, followUpId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// VIP Contacts
export const getVIPContacts = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await ws.getVIPContacts(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const addVIPContact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = addVIPContactSchema.parse(req.body);
  const result = await ws.addVIPContact(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const removeVIPContact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const contactId = req.params.contactId as string;
  if (!contactId) throw new BadRequestError("contactId param required");
  await ws.removeVIPContact(organizationId, contactId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// Briefing
export const getBriefing = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const type = z.enum(["MORNING", "EVENING", "WEEKLY"]).default("MORNING").parse(req.query.type ?? "MORNING");
  const result = await ws.getBriefingCache(organizationId, type);
  if (!result) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "No briefing cached for today" });
    return;
  }
  res.status(StatusCodes.OK).json(result);
};

export const generateBriefing = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = generateBriefingSchema.parse(req.body);
  const result = await ws.generateAndCacheBriefing(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
