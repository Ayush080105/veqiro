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
      agent: Agent.REX,
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
      agent: Agent.REX,
      imageUrl: data.imageUrl,
      tokensUsed: data.tokensUsed,
      model: data.model,
      customInput: data.customInput as Prisma.InputJsonValue | undefined,
    },
  });

export const findRecentMessages = (organizationId: string, limit: number) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.REX },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true },
  });

export const findAllRexMessages = (organizationId: string) =>
  prisma.message.findMany({
    where: { organizationId, agent: Agent.REX },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      customInput: true,
    },
  });

// ── RexDataset ────────────────────────────────────────────────────────────────

export const createDataset = (data: {
  organizationId: string;
  userId: string;
  name: string;
  metricKey: string;
  period: string;
  points: unknown;
  unit?: string | null;
  sourceId?: string | null;
  meta?: unknown;
  purpose?: string;
}) =>
  prisma.rexDataset.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      name: data.name,
      metricKey: data.metricKey,
      period: data.period,
      points: data.points as Prisma.InputJsonValue,
      unit: data.unit,
      sourceId: data.sourceId,
      purpose: data.purpose ?? "actual",
      meta: data.meta as Prisma.InputJsonValue | undefined,
    },
  });

export const findDatasets = (organizationId: string) =>
  prisma.rexDataset.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });

export const findDataset = (id: string, organizationId: string) =>
  prisma.rexDataset.findFirst({ where: { id, organizationId } });

export const deleteDataset = (id: string, organizationId: string) =>
  prisma.rexDataset.deleteMany({ where: { id, organizationId } });

// ── RexPinnedCard ──────────────────────────────────────────────────────────────

export const createPin = (data: {
  organizationId: string;
  userId: string;
  kind: string;
  payload: unknown;
  position?: number;
}) =>
  prisma.rexPinnedCard.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      kind: data.kind,
      payload: data.payload as Prisma.InputJsonValue,
      position: data.position ?? 0,
    },
  });

export const findPins = (organizationId: string) =>
  prisma.rexPinnedCard.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
  });

export const deletePin = (id: string, organizationId: string) =>
  prisma.rexPinnedCard.deleteMany({ where: { id, organizationId } });

// ── RexSettings ────────────────────────────────────────────────────────────────

export const findOrCreateSettings = (organizationId: string) =>
  prisma.rexSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

export const updateSettings = (
  organizationId: string,
  data: {
    weeklyDigestEnabled?: boolean;
    weeklyDigestTimezone?: string;
    weeklyDigestRecipients?: string[];
    alertRules?: unknown;
    ingestApiKey?: string | null;
    columnMappingTemplates?: unknown;
  }
) =>
  prisma.rexSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...data,
      alertRules: data.alertRules as Prisma.InputJsonValue | undefined,
      columnMappingTemplates: data.columnMappingTemplates as Prisma.InputJsonValue | undefined,
    },
    update: {
      ...data,
      alertRules: data.alertRules as Prisma.InputJsonValue | undefined,
      columnMappingTemplates: data.columnMappingTemplates as Prisma.InputJsonValue | undefined,
    },
  });

export const findAllOrgsWithDigestEnabled = () =>
  prisma.rexSettings.findMany({ where: { weeklyDigestEnabled: true } });

export const findAllSettings = () => prisma.rexSettings.findMany();

export const findOrgByApiKey = (apiKey: string) =>
  prisma.rexSettings.findUnique({ where: { ingestApiKey: apiKey } });

export const findDatasetForMetric = (
  organizationId: string,
  metricKey: string,
  purpose = "actual"
) =>
  prisma.rexDataset.findFirst({
    where: { organizationId, metricKey, purpose },
    orderBy: { updatedAt: "desc" },
  });

export const updateDatasetPoints = (
  id: string,
  points: unknown,
  meta?: unknown
) =>
  prisma.rexDataset.update({
    where: { id },
    data: {
      points: points as Prisma.InputJsonValue,
      meta: meta as Prisma.InputJsonValue | undefined,
      updatedAt: new Date(),
    },
  });

// ── Pin sharing (C10) ─────────────────────────────────────────────────────────

export const findPin = (id: string, organizationId: string) =>
  prisma.rexPinnedCard.findFirst({ where: { id, organizationId } });

export const updatePin = (
  id: string,
  organizationId: string,
  data: { isPublic?: boolean; shareToken?: string | null }
) =>
  prisma.rexPinnedCard.updateMany({
    where: { id, organizationId },
    data,
  });

export const findPinByShareToken = (token: string) =>
  prisma.rexPinnedCard.findUnique({ where: { shareToken: token } });

// ── Snapshot: latest weekly-digest result ──────────────────────────────────────

export const findLatestDigestMessage = (organizationId: string) =>
  prisma.message.findFirst({
    where: {
      organizationId,
      agent: Agent.REX,
      role: "assistant",
      customInput: { path: ["actionId"], equals: "rex:weekly-digest" },
    },
    orderBy: { createdAt: "desc" },
    select: { customInput: true, createdAt: true },
  });
