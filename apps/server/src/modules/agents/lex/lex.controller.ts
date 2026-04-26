import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  sendMessageSchema,
  finalizeSourceSchema,
  analyzeContractSchema,
  draftDocumentSchema,
  explainSchema,
  legalResearchSchema,
  complianceCheckSchema,
  queryDocumentSchema,
} from "./lex.schema.js";
import * as lexService from "./lex.service.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const msgLex = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = sendMessageSchema.parse(req.body);
  const result = await lexService.sendMessage(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getLexMessages = async (req: Request, res: Response) => {
  const organizationId =
    (req.query.organizationId as string) ?? req.organizationId;
  if (!organizationId) {
    throw new BadRequestError("Organization ID is required");
  }
  const messages = await lexService.listMessages(organizationId);
  res.status(StatusCodes.OK).json(messages);
};

export const finalizeSource = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = finalizeSourceSchema.parse(req.body);
  const result = await lexService.finalizeSource(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const listSources = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const result = await lexService.listSources(userId, organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const deleteSource = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { id } = req.params as { id: string };
  if (!id) throw new BadRequestError("Source id is required");
  const result = await lexService.deleteSource(userId, organizationId, id);
  res.status(StatusCodes.OK).json(result);
};

export const queryDocument = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = queryDocumentSchema.parse(req.body);
  const result = await lexService.queryDocument(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const analyzeContract = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = analyzeContractSchema.parse(req.body);
  const result = await lexService.analyzeContract(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const draftDocument = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = draftDocumentSchema.parse(req.body);
  const result = await lexService.draftDocument(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const explain = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = explainSchema.parse(req.body);
  const result = await lexService.explainLegalText(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const legalResearch = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = legalResearchSchema.parse(req.body);
  const result = await lexService.legalResearch(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const complianceCheck = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = complianceCheckSchema.parse(req.body);
  const result = await lexService.complianceCheck(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
