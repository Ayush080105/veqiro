import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";
import { resend } from "../../lib/resend.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import { NotFoundError } from "../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import * as feedbackRepository from "./feedback.repository.js";
import type { ListPostsFilters } from "./feedback.repository.js";
import {
  FeedbackStatus,
  FeedbackCategory,
} from "../../../prisma/generated/prisma/client.js";
import { FeedbackStatusUpdateEmail } from "@repo/transactional/emails/feedbackStatusUpdate.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const isAdmin = async (userId: string): Promise<boolean> => {
  // Check Better Auth user-level role (platform admin)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "admin") return true;

  // Also accept org-level owner/admin membership
  const member = await prisma.member.findFirst({
    where: { userId, role: { in: ["admin", "owner"] } },
  });
  return member !== null;
};

const requireAdmin = async (userId: string) => {
  const admin = await isAdmin(userId);
  if (!admin) {
    throw new UnauthenticatedError("Admin access required");
  }
};

// ── Feedback posts ────────────────────────────────────────────────────────────

export const listFeedback = async (
  userId: string,
  filters: ListPostsFilters,
) => {
  const [posts, userVoteIds] = await Promise.all([
    feedbackRepository.listPosts(filters),
    feedbackRepository.getUserVotes(userId),
  ]);

  const voteSet = new Set(userVoteIds);
  return posts.map((post) => ({ ...post, hasVoted: voteSet.has(post.id) }));
};

export const getFeedback = async (userId: string, feedbackId: string) => {
  const [post, comments, userVoteIds] = await Promise.all([
    feedbackRepository.getPost(feedbackId),
    feedbackRepository.listComments(feedbackId),
    feedbackRepository.getUserVotes(userId),
  ]);

  if (!post) throw new NotFoundError("Feedback post not found");

  const voteSet = new Set(userVoteIds);
  return {
    ...post,
    hasVoted: voteSet.has(post.id),
    userVoteIds: [...voteSet],
    comments,
  };
};

export const createFeedback = (
  userId: string,
  data: {
    title: string;
    description: string;
    category: FeedbackCategory;
    agentSlug?: string | null;
  },
) =>
  feedbackRepository.createPost({
    title: data.title,
    description: data.description,
    category: data.category,
    agentSlug: data.agentSlug,
    createdById: userId,
  });

export const toggleVote = async (
  userId: string,
  feedbackId: string,
): Promise<{ voted: boolean; voteCount: number }> => {
  const post = await feedbackRepository.getPost(feedbackId);
  if (!post) throw new NotFoundError("Feedback post not found");

  const existing = await feedbackRepository.getVote(userId, feedbackId);

  if (existing) {
    await feedbackRepository.deleteVote(userId, feedbackId);
    const updated = await feedbackRepository.incrementVoteCount(feedbackId, -1);
    return { voted: false, voteCount: updated.voteCount };
  } else {
    try {
      await feedbackRepository.createVote(userId, feedbackId);
    } catch (err) {
      // Concurrent request already created this vote — treat as already-voted
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const post = await feedbackRepository.getPost(feedbackId);
        return { voted: true, voteCount: post?.voteCount ?? 0 };
      }
      throw err;
    }
    const updated = await feedbackRepository.incrementVoteCount(feedbackId, 1);
    return { voted: true, voteCount: updated.voteCount };
  }
};

export const addComment = async (
  userId: string,
  feedbackId: string,
  content: string,
) => {
  const post = await feedbackRepository.getPost(feedbackId);
  if (!post) throw new NotFoundError("Feedback post not found");

  const adminFlag = await isAdmin(userId);
  return feedbackRepository.createComment({
    content,
    userId,
    feedbackId,
    isAdminReply: adminFlag,
  });
};

export const getSimilarPosts = (title: string) =>
  feedbackRepository.findSimilarPosts(title);

// ── Admin operations ──────────────────────────────────────────────────────────

export const updateStatus = async (
  userId: string,
  feedbackId: string,
  status: FeedbackStatus,
  roadmapEta?: string | null,
  adminReply?: string | null,
  adminNote?: string | null,
) => {
  await requireAdmin(userId);

  const post = await feedbackRepository.getPost(feedbackId);
  if (!post) throw new NotFoundError("Feedback post not found");

  const updated = await feedbackRepository.updatePostStatus(
    feedbackId,
    status,
    roadmapEta,
    adminReply,
    adminNote,
  );

  // Send email notifications to all voters
  const voters = await feedbackRepository.getPostVoterEmails(feedbackId);
  if (voters.length > 0) {
    const getSubjectLine = (status: FeedbackStatus, title: string): string => {
      switch (status) {
        case "LAUNCHED":
          return `🚀 Shipped! "${title}"`;
        case "PLANNED":
          return `📋 Planned: "${title}"`;
        case "IN_PROGRESS":
          return `🔨 In Progress: "${title}"`;
        default:
          return `[Veqiro] Update on "${title}"`;
      }
    };

    await Promise.allSettled(
      voters.map((voter) =>
        resend.emails.send({
          from: process.env.EMAIL_USER!,
          to: voter.email,
          subject: getSubjectLine(status, post.title),
          react: FeedbackStatusUpdateEmail({
            postTitle: post.title,
            newStatus: status,
            postUrl: `${process.env.FRONTEND_URL ?? "https://console.veqiro.com"}/feedback/${post.id}`,
            userName: voter.name,
          }),
        }),
      ),
    );
  }

  return updated;
};

export const mergePost = async (
  userId: string,
  sourceId: string,
  targetId: string,
) => {
  await requireAdmin(userId);

  if (sourceId === targetId) throw new BadRequestError("Cannot merge a post into itself");

  const [source, target] = await Promise.all([
    feedbackRepository.getPost(sourceId),
    feedbackRepository.getPost(targetId),
  ]);

  if (!source) throw new NotFoundError("Source feedback post not found");
  if (!target) throw new NotFoundError("Target feedback post not found");
  if (source.isMerged) throw new BadRequestError("Source post is already merged");

  return feedbackRepository.mergePost(sourceId, targetId);
};

// ── Upcoming agents ───────────────────────────────────────────────────────────

export const listUpcomingAgents = async (userId: string) => {
  const [agents, userVoteIds] = await Promise.all([
    feedbackRepository.listUpcomingAgents(),
    feedbackRepository.getUserUpcomingVotes(userId),
  ]);

  const voteSet = new Set(userVoteIds);
  return agents.map((agent) => ({ ...agent, hasVoted: voteSet.has(agent.id) }));
};

export const toggleUpcomingVote = async (
  userId: string,
  upcomingAgentId: string,
): Promise<{ voted: boolean; voteCount: number }> => {
  const agent = await feedbackRepository.getUpcomingAgent(upcomingAgentId);
  if (!agent) throw new NotFoundError("Upcoming agent not found");

  const existing = await feedbackRepository.getUpcomingVote(userId, upcomingAgentId);

  if (existing) {
    await feedbackRepository.deleteUpcomingVote(userId, upcomingAgentId);
    const updated = await feedbackRepository.incrementUpcomingVoteCount(upcomingAgentId, -1);
    return { voted: false, voteCount: updated.voteCount };
  } else {
    try {
      await feedbackRepository.createUpcomingVote(userId, upcomingAgentId);
    } catch (err) {
      // Concurrent request already created this vote — treat as already-voted
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const refreshed = await feedbackRepository.getUpcomingAgent(upcomingAgentId);
        return { voted: true, voteCount: refreshed?.voteCount ?? 0 };
      }
      throw err;
    }
    const updated = await feedbackRepository.incrementUpcomingVoteCount(upcomingAgentId, 1);
    return { voted: true, voteCount: updated.voteCount };
  }
};

export const createUpcomingAgent = async (
  userId: string,
  data: {
    name: string;
    tagline: string;
    description?: string | null;
    emoji?: string | null;
    color?: string | null;
    order?: number;
    isVisible?: boolean;
  },
) => {
  await requireAdmin(userId);
  return feedbackRepository.createUpcomingAgent(data);
};

export const updateUpcomingAgent = async (
  userId: string,
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
) => {
  await requireAdmin(userId);
  return feedbackRepository.updateUpcomingAgent(id, data);
};

export const deleteUpcomingAgent = async (userId: string, id: string) => {
  await requireAdmin(userId);
  return feedbackRepository.deleteUpcomingAgent(id);
};
