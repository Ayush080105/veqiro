import { prisma } from "../../../config/prisma.js";
import { Agent } from "../../../../prisma/generated/prisma/client.js";

export const createUserMessage = (organizationId: string, content: string) =>
  prisma.message.create({
    data: {
      organizationId,
      role: "user",
      content,
      agent: Agent.SAGE,
    },
  });

export const createAssistantMessage = (data: {
  organizationId: string;
  content: string;
  imageUrl?: string;
  tokensUsed?: number;
  model?: string;
}) =>
  prisma.message.create({
    data: {
      organizationId: data.organizationId,
      role: "assistant",
      content: data.content,
      agent: Agent.SAGE,
      imageUrl: data.imageUrl,
      tokensUsed: data.tokensUsed,
      model: data.model,
    },
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.SAGE },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllSageMessages = (organizationId: string) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.SAGE },
    orderBy: { createdAt: "desc" },
    select: {
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
    },
  });
