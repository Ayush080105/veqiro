import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma } from "../../../../prisma/generated/prisma/client.js";

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
      agent: Agent.LEX,
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
      agent: Agent.LEX,
      imageUrl: data.imageUrl,
      tokensUsed: data.tokensUsed,
      model: data.model,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.LEX },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllLexMessages = (organizationId: string) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.LEX },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      customInput: true,
    },
  });

export const createSource = (data: {
  organizationId: string;
  userId: string;
  sourceId: string;
  name: string;
  type: string;
  typeDetected?: string | null;
  r2Key: string;
  r2Url: string;
  sizeBytes: number;
  pageCount: number;
  chunksCreated: number;
  summary: string;
  keyTopics: string[];
}) =>
  prisma.source.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      agent: Agent.LEX,
      sourceId: data.sourceId,
      name: data.name,
      type: data.type,
      typeDetected: data.typeDetected ?? null,
      r2Key: data.r2Key,
      r2Url: data.r2Url,
      sizeBytes: data.sizeBytes,
      pageCount: data.pageCount,
      chunksCreated: data.chunksCreated,
      summary: data.summary,
      keyTopics: data.keyTopics,
    },
  });

export const findSourcesForUser = (userId: string, organizationId: string) =>
  prisma.source.findMany({
    where: { userId, organizationId, agent: Agent.LEX },
    orderBy: { createdAt: "desc" },
  });

export const findSourceById = (id: string, userId: string, organizationId: string) =>
  prisma.source.findFirst({
    where: { id, userId, organizationId, agent: Agent.LEX },
  });

export const deleteSourceById = (id: string) =>
  prisma.source.delete({ where: { id } });
