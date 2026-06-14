import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma } from "../../../../prisma/generated/prisma/client.js";
import { recordDirectActionContextForAssistantMessage } from "../../../common/utils/contextService.js";

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
  }).then((message) => {
    const customInput = data.customInput as { actionId?: unknown } | undefined;
    if (typeof customInput?.actionId === "string") {
      void recordDirectActionContextForAssistantMessage(message.id);
    }
    return message;
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.LEX },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllLexMessages = (
  organizationId: string,
  opts: { before?: string; limit?: number } = {}
) => {
  const { before, limit = 20 } = opts;
  return prisma.message
    .findMany({
      where: {
        organizationId,
        agent: Agent.LEX,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        customInput: true,
      },
    })
    .then((rows) => rows.reverse());
};

export const createSource = (data: {
  organizationId: string;
  userId: string;
  sourceId: string;
  name: string;
  type: string;
  typeDetected?: string | null;
  r2Key: string;
  sizeBytes: number;
  pageCount: number;
  chunksCreated: number;
  summary: string;
  keyTopics: string[];
}) =>
  prisma.lexSource.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      agent: Agent.LEX,
      sourceId: data.sourceId,
      name: data.name,
      type: data.type,
      typeDetected: data.typeDetected ?? null,
      r2Key: data.r2Key,
      sizeBytes: data.sizeBytes,
      pageCount: data.pageCount,
      chunksCreated: data.chunksCreated,
      summary: data.summary,
      keyTopics: data.keyTopics,
    },
  });

export const findSourcesForUser = (userId: string, organizationId: string) =>
  prisma.lexSource.findMany({
    where: { userId, organizationId, agent: Agent.LEX },
    orderBy: { createdAt: "desc" },
  });

export const findSourceById = (id: string, userId: string, organizationId: string) =>
  prisma.lexSource.findFirst({
    where: { id, userId, organizationId, agent: Agent.LEX },
  });

export const deleteSourceById = (id: string) =>
  prisma.lexSource.delete({ where: { id } });
