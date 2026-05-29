import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  generateIdeasSchema,
  draftContentSchema,
  draftCarouselSchema,
  generateVariantsSchema,
  reviseSchema,
  regenerateImageSchema,
  regenerateContentSchema,
  publishSchema,
  campaignSchema,
  expandBriefSchema,
} from "./maya.schema.js";
import * as mayaService from "./maya.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgMaya = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await mayaService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getMayaMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await mayaService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const generateIdeas = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = generateIdeasSchema.parse(req.body);
  const result = await mayaService.generateIdeas(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftContent = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftContentSchema.parse(req.body);
  const result = await mayaService.draftContent(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const generateVariants = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = generateVariantsSchema.parse(req.body);
  const result = await mayaService.generateVariants(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const revise = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = reviseSchema.parse(req.body);
  const result = await mayaService.revise(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const regenerateImage = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = regenerateImageSchema.parse(req.body);
  const result = await mayaService.regenerateImage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const regenerateContent = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = regenerateContentSchema.parse(req.body);
  const result = await mayaService.regenerateContent(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const publish = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = publishSchema.parse(req.body);
  const result = await mayaService.publish(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftCarousel = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftCarouselSchema.parse(req.body);
  const result = await mayaService.draftCarousel(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getPublishedPosts = async (req: Request, res: Response) => {
  const organizationId = (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) throw new BadRequestError("Organization ID is required");
  const posts = await mayaService.listPublishedPosts(organizationId);
  res.status(StatusCodes.OK).json(posts);
};

export const createCampaign = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = campaignSchema.parse(req.body);
  const result = await mayaService.createCampaign(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const expandBrief = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = expandBriefSchema.parse(req.body);
  const result = await mayaService.expandBrief(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
