import { prisma } from "../../config/prisma.js";
import {
  FeedbackStatus,
  FeedbackCategory,
} from "../../../prisma/generated/prisma/client.js";

// ── FeedbackPost ──────────────────────────────────────────────────────────────

export interface ListPostsFilters {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  agentSlug?: string;
  sort?: "votes" | "newest" | "trending";
  search?: string;
}

export const listPosts = (filters: ListPostsFilters) => {
  const { status, category, agentSlug, sort = "votes", search } = filters;

  const where = {
    isMerged: false,
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(agentSlug ? { agentSlug } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "newest"
      ? { createdAt: "desc" as const }
      : sort === "trending"
        ? [
            { voteCount: "desc" as const },
            { createdAt: "desc" as const },
          ]
        : { voteCount: "desc" as const };

  return prisma.feedbackPost.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      agentSlug: true,
      status: true,
      voteCount: true,
      roadmapEta: true,
      adminReply: true,
      isMerged: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
};

export const getPost = (id: string) =>
  prisma.feedbackPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      agentSlug: true,
      status: true,
      voteCount: true,
      roadmapEta: true,
      adminReply: true,
      adminNote: true,
      isMerged: true,
      mergedIntoId: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { comments: true, votes: true } },
    },
  });

export const createPost = (data: {
  title: string;
  description: string;
  category: FeedbackCategory;
  agentSlug?: string | null;
  createdById: string;
}) =>
  prisma.feedbackPost.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      agentSlug: data.agentSlug ?? null,
      createdById: data.createdById,
    },
  });

export const updatePostStatus = (
  id: string,
  status: FeedbackStatus,
  roadmapEta?: string | null,
  adminReply?: string | null,
  adminNote?: string | null,
) =>
  prisma.feedbackPost.update({
    where: { id },
    data: {
      status,
      ...(roadmapEta !== undefined ? { roadmapEta } : {}),
      ...(adminReply !== undefined ? { adminReply } : {}),
      ...(adminNote !== undefined ? { adminNote } : {}),
    },
  });

export const mergePost = (sourceId: string, targetId: string) =>
  prisma.feedbackPost.update({
    where: { id: sourceId },
    data: { isMerged: true, mergedIntoId: targetId },
  });

export const incrementVoteCount = (id: string, delta: 1 | -1) =>
  prisma.feedbackPost.update({
    where: { id },
    data: { voteCount: { increment: delta } },
    select: { id: true, voteCount: true },
  });

export const findSimilarPosts = (title: string) => {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (words.length === 0) return Promise.resolve([]);

  return prisma.feedbackPost.findMany({
    where: {
      isMerged: false,
      OR: words.map((word) => ({
        title: { contains: word, mode: "insensitive" as const },
      })),
    },
    orderBy: { voteCount: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      voteCount: true,
      category: true,
    },
  });
};

// ── FeedbackVote ──────────────────────────────────────────────────────────────

export const getVote = (userId: string, feedbackId: string) =>
  prisma.feedbackVote.findUnique({
    where: { userId_feedbackId: { userId, feedbackId } },
  });

export const createVote = (userId: string, feedbackId: string) =>
  prisma.feedbackVote.create({ data: { userId, feedbackId } });

export const deleteVote = (userId: string, feedbackId: string) =>
  prisma.feedbackVote.delete({
    where: { userId_feedbackId: { userId, feedbackId } },
  });

export const getUserVotes = async (userId: string): Promise<string[]> => {
  const votes = await prisma.feedbackVote.findMany({
    where: { userId },
    select: { feedbackId: true },
  });
  return votes.map((v) => v.feedbackId);
};

// ── FeedbackComment ───────────────────────────────────────────────────────────

export const listComments = (feedbackId: string) =>
  prisma.feedbackComment.findMany({
    where: { feedbackId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      isAdminReply: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  });

export const createComment = (data: {
  content: string;
  userId: string;
  feedbackId: string;
  isAdminReply: boolean;
}) =>
  prisma.feedbackComment.create({
    data,
    select: {
      id: true,
      content: true,
      isAdminReply: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  });

// ── UpcomingAgent ─────────────────────────────────────────────────────────────

export const getUpcomingAgent = (id: string) =>
  prisma.upcomingAgent.findUnique({
    where: { id },
    select: { id: true, name: true, isVisible: true, voteCount: true },
  });

export const listUpcomingAgents = () =>
  prisma.upcomingAgent.findMany({
    where: { isVisible: true },
    orderBy: [{ order: "asc" }, { voteCount: "desc" }],
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      emoji: true,
      color: true,
      order: true,
      isVisible: true,
      voteCount: true,
      createdAt: true,
    },
  });

export const createUpcomingAgent = (data: {
  name: string;
  tagline: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  order?: number;
  isVisible?: boolean;
}) => prisma.upcomingAgent.create({ data });

export const updateUpcomingAgent = (
  id: string,
  data: Partial<{
    name: string;
    tagline: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    order: number;
    isVisible: boolean;
  }>,
) => prisma.upcomingAgent.update({ where: { id }, data });

export const deleteUpcomingAgent = (id: string) =>
  prisma.upcomingAgent.delete({ where: { id } });

export const incrementUpcomingVoteCount = (id: string, delta: 1 | -1) =>
  prisma.upcomingAgent.update({
    where: { id },
    data: { voteCount: { increment: delta } },
    select: { id: true, voteCount: true },
  });

// ── UpcomingAgentVote ─────────────────────────────────────────────────────────

export const getUpcomingVote = (userId: string, upcomingAgentId: string) =>
  prisma.upcomingAgentVote.findUnique({
    where: { userId_upcomingAgentId: { userId, upcomingAgentId } },
  });

export const createUpcomingVote = (userId: string, upcomingAgentId: string) =>
  prisma.upcomingAgentVote.create({ data: { userId, upcomingAgentId } });

export const deleteUpcomingVote = (userId: string, upcomingAgentId: string) =>
  prisma.upcomingAgentVote.delete({
    where: { userId_upcomingAgentId: { userId, upcomingAgentId } },
  });

export const getUserUpcomingVotes = async (userId: string): Promise<string[]> => {
  const votes = await prisma.upcomingAgentVote.findMany({
    where: { userId },
    select: { upcomingAgentId: true },
  });
  return votes.map((v) => v.upcomingAgentId);
};

// ── Email helpers ─────────────────────────────────────────────────────────────

export const getPostVoterEmails = async (
  feedbackId: string,
): Promise<{ email: string; name: string }[]> => {
  const votes = await prisma.feedbackVote.findMany({
    where: { feedbackId },
    select: { user: { select: { email: true, name: true } } },
  });
  return votes.map((v) => ({ email: v.user.email, name: v.user.name }));
};
