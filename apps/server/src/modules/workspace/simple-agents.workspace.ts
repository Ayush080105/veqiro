import { prisma } from "../../config/prisma.js";
import { Agent, WorkObjectStatus } from "../../../prisma/generated/prisma/client.js";
import {
  projectWorkObject,
  reprojectAll,
  unprojectWorkObject,
} from "./work-objects.projector.js";

/**
 * Projections for agents whose work objects are simple enough not to need a
 * bridge file of their own.
 *
 * Rex's datasets and Sage's saved keywords are flat rows with no lifecycle
 * worth mapping — they exist or they do not. Giving each a maya-sized
 * *.workspace.ts would be ceremony; when either grows a real lifecycle (Sage's
 * audits becoming a tracked issue queue, say) it earns its own file then.
 */

export const SIMPLE_KINDS = {
  rexDataset: "rex.dataset",
  sageKeyword: "sage.keyword",
} as const;

// ─── Rex datasets ────────────────────────────────────────────────────────────

export async function projectRexDataset(datasetId: string): Promise<void> {
  try {
    const dataset = await prisma.rexDataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
      await unprojectWorkObject(SIMPLE_KINDS.rexDataset, datasetId);
      return;
    }
    await projectWorkObject(rexDatasetToWorkObject(dataset));
  } catch (err) {
    console.error("[rex] projection failed", datasetId, err);
  }
}

type RexDatasetRow = Awaited<ReturnType<typeof prisma.rexDataset.findMany>>[number];

function rexDatasetToWorkObject(dataset: RexDatasetRow) {
  return {
    organizationId: dataset.organizationId,
    agent: Agent.REX,
    kind: SIMPLE_KINDS.rexDataset,
    sourceId: dataset.id,
    title: dataset.name,
    status: WorkObjectStatus.ACTIVE,
    dueAt: null,
    ownerUserId: dataset.userId,
    preview: {
      metricKey: dataset.metricKey,
      unit: dataset.unit,
      period: dataset.period,
      purpose: dataset.purpose,
    },
    sourceUpdatedAt: dataset.updatedAt ?? dataset.createdAt,
  };
}

export async function reindexRexDatasets(organizationId?: string) {
  const rows = await prisma.rexDataset.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(SIMPLE_KINDS.rexDataset, rows.map(rexDatasetToWorkObject), organizationId);
}

// ─── Sage keywords ───────────────────────────────────────────────────────────

type SageKeywordRow = Awaited<ReturnType<typeof prisma.sageSavedKeyword.findMany>>[number];

function sageKeywordToWorkObject(keyword: SageKeywordRow) {
  return {
    organizationId: keyword.organizationId,
    agent: Agent.SAGE,
    kind: SIMPLE_KINDS.sageKeyword,
    sourceId: keyword.id,
    title: keyword.keyword,
    status: WorkObjectStatus.ACTIVE,
    dueAt: null,
    ownerUserId: null,
    preview: {
      searchIntent: keyword.searchIntent,
      difficulty: keyword.estimatedDifficulty,
      volume: keyword.searchVolumeEstimate,
      suggestedContentType: keyword.suggestedContentType,
    },
    sourceUpdatedAt: keyword.createdAt,
  };
}

export async function projectSageKeyword(keywordId: string): Promise<void> {
  try {
    const keyword = await prisma.sageSavedKeyword.findUnique({ where: { id: keywordId } });
    if (!keyword) {
      await unprojectWorkObject(SIMPLE_KINDS.sageKeyword, keywordId);
      return;
    }
    await projectWorkObject(sageKeywordToWorkObject(keyword));
  } catch (err) {
    console.error("[sage] projection failed", keywordId, err);
  }
}

export async function reindexSageKeywords(organizationId?: string) {
  const rows = await prisma.sageSavedKeyword.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(SIMPLE_KINDS.sageKeyword, rows.map(sageKeywordToWorkObject), organizationId);
}
