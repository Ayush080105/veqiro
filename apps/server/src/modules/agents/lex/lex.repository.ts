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
    where: { organizationId, agent: Agent.LEX, isTeam: false },
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
        // The team room lives in the same table; its messages are not this chat's.
        isTeam: false,
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
        pinned: true,
        pinnedAt: true,
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

export const findSourcesForUser = (userId: string, organizationId: string, q?: string) => {
  const term = q?.trim();
  return prisma.lexSource.findMany({
    where: {
      userId,
      organizationId,
      agent: Agent.LEX,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" as const } },
              { counterparty: { contains: term, mode: "insensitive" as const } },
              { typeDetected: { contains: term, mode: "insensitive" as const } },
              { summary: { contains: term, mode: "insensitive" as const } },
              { paymentTerms: { contains: term, mode: "insensitive" as const } },
              { findings: { some: { OR: [
                { title: { contains: term, mode: "insensitive" as const } },
                { explanation: { contains: term, mode: "insensitive" as const } },
                { quote: { contains: term, mode: "insensitive" as const } },
              ] } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findUpcomingObligations = (userId: string, organizationId: string) =>
  prisma.lexObligation.findMany({
    where: {
      organizationId,
      status: "open",
      owner: { in: ["you", "both"] },
      dueDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      source: { userId },
    },
    orderBy: { dueDate: "asc" },
    select: { sourceRowId: true, description: true, dueDate: true },
  });

export const findSourceDetail = (id: string, userId: string, organizationId: string) =>
  prisma.lexSource.findFirst({
    where: { id, userId, organizationId, agent: Agent.LEX },
    include: {
      findings: { orderBy: { createdAt: "asc" } },
      obligations: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

/** Every version of a document, oldest first, following previousVersionId both ways. */
export const findVersionChain = async (
  row: { id: string; previousVersionId: string | null },
  userId: string,
  organizationId: string
) => {
  const all = await prisma.lexSource.findMany({
    where: { userId, organizationId, agent: Agent.LEX },
    select: { id: true, name: true, version: true, previousVersionId: true, createdAt: true, lastReviewedAt: true, reviewHeadline: true },
  });
  const byId = new Map(all.map((s) => [s.id, s]));
  const chain: typeof all = [];
  let cursor = byId.get(row.id);
  while (cursor?.previousVersionId && byId.has(cursor.previousVersionId) && chain.length < 50) {
    cursor = byId.get(cursor.previousVersionId);
    if (cursor) chain.unshift(cursor);
  }
  chain.push(byId.get(row.id)!);
  let next = all.find((s) => s.previousVersionId === row.id);
  while (next && chain.length < 100) {
    chain.push(next);
    const nextId: string = next.id;
    next = all.find((s) => s.previousVersionId === nextId);
  }
  return chain.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastReviewedAt: s.lastReviewedAt?.toISOString() ?? null }));
};

export const findSourceById = (id: string, userId: string, organizationId: string) =>
  prisma.lexSource.findFirst({
    where: { id, userId, organizationId, agent: Agent.LEX },
  });

/** Most recent review results, newest first, for summarising per document. */
export const findRecentReviewMessages = (organizationId: string, limit = 40) =>
  prisma.message.findMany({
    where: {
      organizationId,
      agent: Agent.LEX,
      role: "assistant",
      customInput: { path: ["actionId"], equals: "lex:analyze-contract" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { customInput: true, createdAt: true },
  });

export const deleteSourceById = (id: string) =>
  prisma.lexSource.delete({ where: { id } });
