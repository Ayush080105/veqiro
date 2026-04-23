import { prisma } from "../../config/prisma.js";
import { Agent, SocialPlatform } from "../../../prisma/generated/prisma/client.js";

const AGENT_SLUGS = ["maya", "rex", "scout", "sage", "lex", "vega"] as const;
export type AgentSlug = (typeof AGENT_SLUGS)[number];

const SLUG_BY_ENUM: Record<Agent, AgentSlug> = {
  MAYA: "maya",
  REX: "rex",
  SCOUT: "scout",
  SAGE: "sage",
  LEX: "lex",
  VEGA: "vega",
};

export const ENUM_BY_SLUG: Record<AgentSlug, Agent> = {
  maya: Agent.MAYA,
  rex: Agent.REX,
  scout: Agent.SCOUT,
  sage: Agent.SAGE,
  lex: Agent.LEX,
  vega: Agent.VEGA,
};

export const agentEnumsFromSlugs = (slugs: AgentSlug[] | undefined): Agent[] | undefined =>
  slugs && slugs.length > 0 ? slugs.map((s) => ENUM_BY_SLUG[s]) : undefined;

const PLATFORM_BY_ENUM: Record<SocialPlatform, "twitter" | "linkedin" | "instagram"> = {
  TWITTER: "twitter",
  LINKEDIN: "linkedin",
  INSTAGRAM: "instagram",
};

export type MessageRow = {
  agent: Agent;
  role: string;
  content: string;
  createdAt: Date;
  tokensUsed: number;
};

export const findMessagesInWindow = (organizationId: string, since: Date): Promise<MessageRow[]> =>
  prisma.message.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { agent: true, role: true, content: true, createdAt: true, tokensUsed: true },
  });

export const countMessagesBetween = (organizationId: string, from: Date, to: Date) =>
  prisma.message.count({
    where: { organizationId, createdAt: { gte: from, lt: to } },
  });

export const sumTokensSince = async (organizationId: string, since: Date): Promise<number> => {
  const agg = await prisma.message.aggregate({
    where: { organizationId, createdAt: { gte: since } },
    _sum: { tokensUsed: true },
  });
  return agg._sum.tokensUsed ?? 0;
};

export const countPublishedBetween = (
  organizationId: string,
  from: Date,
  to: Date,
  status = "success",
) =>
  prisma.publishedPost.count({
    where: { organizationId, status, publishedAt: { gte: from, lt: to } },
  });

export const groupPostsByPlatform = (organizationId: string) =>
  prisma.publishedPost.groupBy({
    by: ["platform"],
    where: { organizationId, status: "success" },
    _count: { _all: true },
  });

export const groupPostsByStatus = (organizationId: string) =>
  prisma.publishedPost.groupBy({
    by: ["status"],
    where: { organizationId },
    _count: { _all: true },
  });

export const countFailedPosts = (organizationId: string) =>
  prisma.publishedPost.count({ where: { organizationId, status: "failed" } });

export const findExpiringIntegrations = (organizationId: string, before: Date) =>
  prisma.socialAccount.findMany({
    where: {
      organizationId,
      accessTokenExpiresAt: { not: null, lte: before },
    },
    select: {
      id: true,
      platform: true,
      accountName: true,
      accessTokenExpiresAt: true,
    },
  });

export const findRecentPublishedPosts = (organizationId: string, limit: number) =>
  prisma.publishedPost.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      platform: true,
      status: true,
      caption: true,
      createdAt: true,
      publishedAt: true,
    },
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { agent: true, role: true, content: true, createdAt: true },
  });

export { AGENT_SLUGS, SLUG_BY_ENUM, PLATFORM_BY_ENUM };
