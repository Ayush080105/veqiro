import { prisma } from "../../config/prisma.js";
import { Agent, MemoryOrigin } from "../../../prisma/generated/prisma/client.js";

/**
 * Turns what the summariser extracts into rows a customer can review.
 *
 * AgentMemory.longTermFacts is the prompt-assembly path: a capped list of
 * strings. MemoryItem is the reviewable surface, and until this module nothing
 * wrote to it, so the Memory module was permanently empty while the agent
 * quietly accumulated facts nobody could see. Both are now fed from the same
 * extraction; AgentMemory keeps feeding prompts and this gives the customer a
 * way to confirm or retire what is in them.
 *
 * Everything here is best-effort and must never throw into the work that
 * triggered it — a memory that fails to mirror is a stale page, not a failed
 * chat turn.
 */

const TAG = /^\[([A-Za-z]+)\]\s*/;
/** Tags that mean something about the customer's business; the rest is bookkeeping. */
const KIND_BY_TAG: Record<string, string> = {
  PREFERENCE: "preference",
  FACT: "fact",
  CONSTRAINT: "constraint",
  DECISION: "decision",
};
/** "[CONTEXT] Maya completed X" is an audit line, not something the agent knows about you. */
const SKIPPED_TAGS = new Set(["CONTEXT"]);

const fingerprint = (s: string) => s.trim().toLowerCase().slice(0, 60);

export interface ParsedFact {
  kind: string;
  content: string;
}

/** Split "[PREFERENCE] Keep it short" into a kind and its text; null if it should not be shown. */
export function parseFact(raw: string): ParsedFact | null {
  const text = raw.trim();
  if (!text) return null;
  const m = TAG.exec(text);
  const tag = m?.[1]?.toUpperCase();
  if (tag && SKIPPED_TAGS.has(tag)) return null;
  const content = (m ? text.slice(m[0].length) : text).trim();
  if (!content) return null;
  return { kind: (tag && KIND_BY_TAG[tag]) || "fact", content };
}

/**
 * Mirror newly extracted facts. Preferences are company-wide (agent null) —
 * that is where the summariser already files them — everything else belongs to
 * the agent that learned it.
 *
 * Retired rows count for dedup on purpose: a fact the customer told an agent to
 * forget must not be re-learned from the next summary and reappear.
 */
export async function recordExtractedFacts(params: {
  organizationId: string;
  agent: Agent;
  facts: string[];
  sourceKind?: string;
  sourceId?: string | null;
}): Promise<number> {
  try {
    const parsed = params.facts.map(parseFact).filter((f): f is ParsedFact => f !== null);
    if (parsed.length === 0) return 0;

    const known = await prisma.memoryItem.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [{ agent: params.agent }, { agent: null }],
      },
      select: { content: true },
    });
    const seen = new Set(known.map((k) => fingerprint(k.content)));

    const fresh: ParsedFact[] = [];
    for (const f of parsed) {
      const fp = fingerprint(f.content);
      if (seen.has(fp)) continue;
      seen.add(fp);
      fresh.push(f);
    }
    if (fresh.length === 0) return 0;

    await prisma.memoryItem.createMany({
      data: fresh.map((f) => ({
        organizationId: params.organizationId,
        agent: f.kind === "preference" ? null : params.agent,
        kind: f.kind,
        content: f.content,
        origin: MemoryOrigin.AGENT,
        sourceKind: params.sourceKind ?? "conversation",
        sourceId: params.sourceId ?? null,
      })),
    });
    return fresh.length;
  } catch (err) {
    console.error("[memory-items] could not mirror extracted facts", err);
    return 0;
  }
}

/**
 * Preferences learned before this existed live in OrgMemory.sharedMemory. They
 * are company-wide, so they become agent-null items — once, while none exist.
 */
async function backfillOrgPreferences(organizationId: string, agent: Agent): Promise<void> {
  const has = await prisma.memoryItem.count({
    where: { organizationId, agent: null, kind: "preference" },
  });
  if (has > 0) return;
  const org = await prisma.orgMemory.findUnique({
    where: { organizationId },
    select: { sharedMemory: true },
  });
  const shared = (org?.sharedMemory ?? {}) as { userPreferences?: unknown };
  const prefs = Array.isArray(shared.userPreferences)
    ? (shared.userPreferences as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  if (prefs.length === 0) return;
  await recordExtractedFacts({
    organizationId,
    agent,
    facts: prefs.map((p) => (p.trimStart().startsWith("[") ? p : `[PREFERENCE] ${p}`)),
    sourceKind: "legacy-memory",
  });
}

/**
 * One-off catch-up for organisations that had facts before this existed.
 * Runs only while the agent has no rows at all, so it is idempotent and cannot
 * resurrect anything a customer has since retired.
 */
export async function backfillFromLegacyMemory(
  organizationId: string,
  agent: Agent,
): Promise<void> {
  try {
    await backfillOrgPreferences(organizationId, agent);
    const existing = await prisma.memoryItem.count({ where: { organizationId, agent } });
    if (existing > 0) return;
    const memory = await prisma.agentMemory.findUnique({
      where: { organizationId_agent: { organizationId, agent } },
      select: { longTermFacts: true },
    });
    const facts = Array.isArray(memory?.longTermFacts) ? (memory.longTermFacts as string[]) : [];
    if (facts.length === 0) return;
    await recordExtractedFacts({
      organizationId,
      agent,
      facts,
      sourceKind: "legacy-memory",
    });
  } catch (err) {
    console.error("[memory-items] backfill failed", err);
  }
}

// ─── What the agent actually reads ───────────────────────────────────────────

const KIND_PREFIX: Record<string, string> = {
  preference: "Preference: ",
  constraint: "Constraint: ",
  decision: "Decision: ",
};

/** Higher = closer to the end of the list, which is what the model keeps. */
const weight = (r: { confirmed: boolean; origin: MemoryOrigin }) =>
  (r.confirmed ? 2 : 0) + (r.origin === MemoryOrigin.USER ? 1 : 0);

export interface PromptFacts {
  facts: string[];
  /** False when the table could not be read and `facts` is the old list. */
  fromItems: boolean;
}

/**
 * The facts an agent is given for its next turn.
 *
 * This is the single place the Memory module and the model meet. Whatever a
 * customer confirms, adds or forgets there is exactly what changes here, which
 * is the point: a memory screen that the agent does not read is a diary.
 *
 * The AI service keeps only the tail of the list, so order is priority — what
 * the customer said or confirmed comes last (and survives), unconfirmed
 * inferences come first (and drop off first). Unconfirmed items that do make it
 * are labelled as such so the model treats them as a guess.
 *
 * Falls back to `legacy` (AgentMemory.longTermFacts) if the read fails: a
 * chat turn must never depend on this table being up.
 */
export async function loadPromptFacts(
  organizationId: string,
  agent: Agent,
  legacy: string[],
): Promise<PromptFacts> {
  try {
    const where = {
      organizationId,
      retiredAt: null,
      OR: [{ agent }, { agent: null }],
    };
    // Newest 200, not oldest: if a customer ever has more than the cap, it is the
    // recent things they said that must survive. Reversed back to oldest-first so
    // the stable weight sort below still puts the newest last within a tier.
    const newest = () =>
      prisma.memoryItem.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    let rows = (await newest()).slice().reverse();
    if (rows.length === 0) {
      await backfillFromLegacyMemory(organizationId, agent);
      rows = (await newest()).slice().reverse();
    }
    const ordered = [...rows].sort((a, b) => weight(a) - weight(b));
    return {
      fromItems: true,
      facts: ordered.map((r) => {
        const text = `${KIND_PREFIX[r.kind] ?? ""}${r.content}`;
        return r.confirmed ? text : `(not yet confirmed) ${text}`;
      }),
    };
  } catch (err) {
    console.error("[memory-items] falling back to legacy facts", err);
    return { facts: legacy, fromItems: false };
  }
}

export const MEMORY_KINDS = ["fact", "preference", "constraint", "decision"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/**
 * Something the customer tells an employee to remember.
 *
 * Confirmed from the start: they said it, so there is nothing to confirm. That
 * is what separates it from an inference, and why it outranks one in the prompt.
 */
export async function addMemoryItem(params: {
  organizationId: string;
  userId: string;
  /** Null makes it company-wide — every employee works from it. */
  agent: Agent | null;
  kind: MemoryKind;
  content: string;
}) {
  return prisma.memoryItem.create({
    data: {
      organizationId: params.organizationId,
      agent: params.agent,
      kind: params.kind,
      content: params.content.trim(),
      origin: MemoryOrigin.USER,
      sourceKind: "user",
      sourceId: params.userId,
      confirmed: true,
      confirmedAt: new Date(),
      confirmedByUserId: params.userId,
    },
  });
}
