import { prisma } from "../../config/prisma.js";
import {
  Agent,
  WorkObjectStatus,
  type Prisma,
} from "../../../prisma/generated/prisma/client.js";

/**
 * Projection into WorkObjectIndex.
 *
 * The contract, and the thing that keeps this from rotting: **the typed table
 * is the truth and this index is derived**. Nothing may read the index to make
 * a decision — list rows, yes; anything load-bearing re-reads the typed row.
 * That way drift is a stale list, never a wrong answer.
 *
 * Call these from the owning *service* write points, never from a controller:
 * controllers are not the only writer (crons and the AI service also write), so
 * projecting at the controller guarantees gaps. Deletes must project inside the
 * same transaction as the typed delete, or a failed delete leaves a ghost row.
 *
 * When it does drift anyway, POST /internal/work-objects/reindex rebuilds a
 * kind from scratch. Treat that as the escape hatch it is.
 */

/** Dotted kinds. Kept here so the strings have exactly one home. */
export const WORK_OBJECT_KINDS = {
  lexContract: "lex.contract",
  mayaPost: "maya.post",
  mayaCampaign: "maya.campaign",
} as const;

export type WorkObjectKind = (typeof WORK_OBJECT_KINDS)[keyof typeof WORK_OBJECT_KINDS];

export interface ProjectInput {
  organizationId: string;
  agent: Agent;
  kind: string;
  sourceId: string;
  title: string;
  status?: WorkObjectStatus;
  dueAt?: Date | null;
  ownerUserId?: string | null;
  /** Display-only. Never read this to decide anything. */
  preview?: Prisma.InputJsonValue;
  sourceUpdatedAt: Date;
}

export async function projectWorkObject(input: ProjectInput): Promise<void> {
  const data = {
    organizationId: input.organizationId,
    agent: input.agent,
    title: input.title,
    status: input.status ?? WorkObjectStatus.ACTIVE,
    dueAt: input.dueAt ?? null,
    ownerUserId: input.ownerUserId ?? null,
    preview: input.preview,
    sourceUpdatedAt: input.sourceUpdatedAt,
  };
  try {
    await prisma.workObjectIndex.upsert({
      where: { kind_sourceId: { kind: input.kind, sourceId: input.sourceId } },
      create: { kind: input.kind, sourceId: input.sourceId, ...data },
      update: data,
    });
  } catch (err) {
    // Non-fatal by design: a missing index row degrades a list, while throwing
    // here would fail the contract upload that triggered it.
    console.error("[work-objects] projection failed", input.kind, input.sourceId, err);
  }
}

/**
 * Remove an object from the index.
 *
 * Pass the transaction client when deleting the typed row inside one, so the
 * index entry cannot survive a rolled-back delete.
 */
export async function unprojectWorkObject(
  kind: string,
  sourceId: string,
  client: Pick<typeof prisma, "workObjectIndex"> = prisma,
): Promise<void> {
  try {
    await client.workObjectIndex.deleteMany({ where: { kind, sourceId } });
  } catch (err) {
    // Non-fatal, like projection. By the time this runs the typed row is
    // already gone, so throwing would fail a delete that actually succeeded,
    // and the worst case here is a ghost list row that reindex repairs.
    // Callers needing the two to succeed or fail together pass a transaction
    // client, which makes rollback the transaction's job rather than this
    // function's.
    console.error("[work-objects] unproject failed", kind, sourceId, err);
  }
}

/**
 * Replace every index row for one kind, given the rows that should exist.
 *
 * The generic half of a reindex: the caller supplies the projections (only it
 * knows how to read its own typed table), and this sweeps away index rows whose
 * source has since vanished. That is what makes reindex repair ghosts as well
 * as gaps.
 */
export async function reprojectAll(
  kind: string,
  rows: ProjectInput[],
  organizationId?: string,
): Promise<{ kind: string; projected: number; removed: number }> {
  for (const row of rows) {
    await projectWorkObject(row);
  }

  const liveIds = new Set(rows.map((r) => r.sourceId));
  const indexed = await prisma.workObjectIndex.findMany({
    where: { kind, ...(organizationId ? { organizationId } : {}) },
    select: { sourceId: true },
  });
  const stale = indexed.filter((row) => !liveIds.has(row.sourceId)).map((r) => r.sourceId);
  if (stale.length > 0) {
    await prisma.workObjectIndex.deleteMany({ where: { kind, sourceId: { in: stale } } });
  }

  return { kind, projected: rows.length, removed: stale.length };
}
