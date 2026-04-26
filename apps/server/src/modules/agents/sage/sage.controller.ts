import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  keywordResearchSchema,
  generateBlogSchema,
  analyzeContentSchema,
  contentBriefSchema,
  saveKeywordSchema,
} from "./sage.schema.js";
import * as sageService from "./sage.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgSage = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await sageService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getSageMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await sageService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const keywordResearch = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = keywordResearchSchema.parse(req.body);
  const result = await sageService.keywordResearch(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const generateBlog = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = generateBlogSchema.parse(req.body);
  const result = await sageService.generateBlog(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const analyzeContent = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = analyzeContentSchema.parse(req.body);
  const result = await sageService.analyzeContent(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const contentBrief = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = contentBriefSchema.parse(req.body);
  const result = await sageService.contentBrief(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

// ── Saved Keywords ────────────────────────────────────────────────────────────

export const getSavedKeywords = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await sageService.listSavedKeywords(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const addSavedKeyword = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = saveKeywordSchema.parse(req.body);
  const result = await sageService.saveKeyword(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const removeSavedKeyword = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { id } = req.params;
  if (!id) throw new BadRequestError("Keyword id is required");
  await sageService.unsaveKeyword(id, organizationId);
  res.status(StatusCodes.NO_CONTENT).send();
};
