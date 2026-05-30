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
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
  updateCalendarEventSchema,
  rescheduleDraftSchema,
  bulkInboxActionSchema,
  createLabelSchema,
  updateLabelSchema,
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
  const force = req.query.force === "true";
  const result = await ws.getInbox(userId, organizationId, input, force);
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

// Calendar
export const getCalendarEvents = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getCalendarSchema.parse(req.query);
  const result = await ws.getCalendar(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const createCalendarEventHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = createCalendarEventSchema.parse(req.body);
  const result = await ws.createCalendarEventWorkspace(userId, organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const getMeetingPrepHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getMeetingPrepSchema.parse(req.body);
  const result = await ws.getMeetingPrepWorkspace(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// Post-meeting follow-up
export const postMeetingFollowUpHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = postMeetingFollowUpSchema.parse(req.body);
  const result = await ws.getPostMeetingFollowUp(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const sendFollowUpEmailHandler = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const input = sendFollowUpEmailSchema.parse(req.body);
  const result = await ws.sendFollowUpEmail(userId, input);
  res.status(StatusCodes.OK).json(result);
};

// Auto-reschedule
export const updateCalendarEventHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const eventId = req.params.eventId as string;
  if (!eventId) throw new BadRequestError("eventId param required");
  const input = updateCalendarEventSchema.parse(req.body);
  const result = await ws.updateCalendarEventWorkspace(userId, organizationId, eventId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getRescheduleDraftHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = rescheduleDraftSchema.parse(req.body);
  const result = await ws.getRescheduleDraft(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const bulkInboxActionHandler = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const input = bulkInboxActionSchema.parse(req.body);
  const result = await ws.bulkInboxAction(userId, input);
  res.status(StatusCodes.OK).json(result);
};

// Labels
export const getLabelsList = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await ws.getLabels(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const createLabelHandler = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = createLabelSchema.parse(req.body);
  const result = await ws.createLabel(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const deleteLabelHandler = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const labelId = req.params.labelId as string;
  if (!labelId) throw new BadRequestError("labelId param required");
  await ws.deleteLabel(organizationId, labelId);
  res.status(StatusCodes.NO_CONTENT).send();
};

export const updateLabelHandler = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const labelId = req.params.labelId as string;
  if (!labelId) throw new BadRequestError("labelId param required");
  const input = updateLabelSchema.parse(req.body);
  const result = await ws.updateLabel(organizationId, labelId, input);
  res.status(StatusCodes.OK).json(result);
};
