import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma, SocialPlatform } from "../../../../prisma/generated/prisma/client.js";

export const createUserMessage = (data: {
  organizationId: string;
  userId: string;
  content: string;
  customInput?: unknown;
}) =>
  prisma.message.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      role: "user",
      content: data.content,
      agent: Agent.MAYA,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  });

export const createAssistantMessage = (data: {
  organizationId: string;
  userId: string;
  content: string;
  imageUrl?: string;
  tokensUsed?: number;
  model?: string;
  customInput?: unknown;
}) =>
  prisma.message.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      role: "assistant",
      content: data.content,
      agent: Agent.MAYA,
      imageUrl: data.imageUrl,
      tokensUsed: data.tokensUsed,
      model: data.model,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.MAYA },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllMayaMessages = (organizationId: string) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.MAYA },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      customInput: true,
    },
  });

export const findPublishedPosts = (organizationId: string) =>
  prisma.publishedPost.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      caption: true,
      hashtags: true,
      imageUrl: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      platformPostId: true,
    },
  });

export const getRecentIdeas = (
  organizationId: string,
  platform: SocialPlatform,
  limit = 100
) =>
  prisma.mayaContentIdea.findMany({
    where: { organizationId, platform },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { title: true, hook: true, contentType: true },
  });

export const saveIdeas = (
  ideas: {
    organizationId: string;
    platform: SocialPlatform;
    title: string;
    hook: string;
    contentType: string;
  }[]
) => prisma.mayaContentIdea.createMany({ data: ideas });
