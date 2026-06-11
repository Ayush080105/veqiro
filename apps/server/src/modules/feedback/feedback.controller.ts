import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import * as feedbackService from "./feedback.service.js";
import * as feedbackRepository from "./feedback.repository.js";
import {
  createFeedbackSchema,
  updateStatusSchema,
  mergePostSchema,
  addCommentSchema,
  createUpcomingAgentSchema,
  updateUpcomingAgentSchema,
  listFeedbackSchema,
} from "./feedback.schemas.js";
import {
  FeedbackStatus,
  FeedbackCategory,
} from "../../../prisma/generated/prisma/client.js";

const requireAuthContext = (req: Request): { userId: string } => {
  if (!req.userId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId };
};

// ── Feedback posts ────────────────────────────────────────────────────────────

export const listFeedback = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const filters = listFeedbackSchema.parse(req.query);
  const posts = await feedbackService.listFeedback(userId, {
    status: filters.status as FeedbackStatus | undefined,
    category: filters.category as FeedbackCategory | undefined,
    agentSlug: filters.agentSlug,
    sort: filters.sort,
    search: filters.search,
  });
  res.status(StatusCodes.OK).json(posts);
};

export const createFeedback = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const input = createFeedbackSchema.parse(req.body);
  const post = await feedbackService.createFeedback(userId, {
    title: input.title,
    description: input.description,
    category: input.category as FeedbackCategory,
    agentSlug: input.agentSlug,
  });
  res.status(StatusCodes.CREATED).json(post);
};

export const getSimilarPosts = async (req: Request, res: Response) => {
  requireAuthContext(req);
  const title = req.query["title"] as string | undefined;
  if (!title) throw new BadRequestError("title query param is required");
  const posts = await feedbackService.getSimilarPosts(title);
  res.status(StatusCodes.OK).json(posts);
};

export const getFeedback = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const post = await feedbackService.getFeedback(userId, id);
  res.status(StatusCodes.OK).json(post);
};

export const toggleVote = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const result = await feedbackService.toggleVote(userId, id);
  res.status(StatusCodes.OK).json(result);
};

export const addComment = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const input = addCommentSchema.parse(req.body);
  const comment = await feedbackService.addComment(userId, id, input.content);
  res.status(StatusCodes.CREATED).json(comment);
};

// ── Admin operations ──────────────────────────────────────────────────────────

export const updateStatus = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const input = updateStatusSchema.parse(req.body);
  const post = await feedbackService.updateStatus(
    userId,
    id,
    input.status as FeedbackStatus,
    input.roadmapEta,
    input.adminReply,
    input.adminNote,
  );
  res.status(StatusCodes.OK).json(post);
};

export const mergePost = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const input = mergePostSchema.parse(req.body);
  const result = await feedbackService.mergePost(userId, id, input.targetId);
  res.status(StatusCodes.OK).json(result);
};

// ── Upcoming agents ───────────────────────────────────────────────────────────

export const listUpcomingAgents = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const agents = await feedbackService.listUpcomingAgents(userId);
  res.status(StatusCodes.OK).json(agents);
};

export const toggleUpcomingVote = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const result = await feedbackService.toggleUpcomingVote(userId, id);
  res.status(StatusCodes.OK).json(result);
};

export const createUpcomingAgent = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const input = createUpcomingAgentSchema.parse(req.body);
  const agent = await feedbackService.createUpcomingAgent(userId, input);
  res.status(StatusCodes.CREATED).json(agent);
};

export const updateUpcomingAgent = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  const input = updateUpcomingAgentSchema.parse(req.body);
  const agent = await feedbackService.updateUpcomingAgent(userId, id, input);
  res.status(StatusCodes.OK).json(agent);
};

export const deleteUpcomingAgent = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const id = req.params["id"] as string;
  await feedbackService.deleteUpcomingAgent(userId, id);
  res.status(StatusCodes.NO_CONTENT).send();
};

