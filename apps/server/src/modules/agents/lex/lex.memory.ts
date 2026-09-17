/**
 * Lex legal memory: what Lex keeps about each document after it has been reviewed, and the
 * read models built on top of it (Legal Watch, the Legal Brief, document detail).
 *
 * Everything here reuses a review that already ran. Saving a review writes the contract
 * metadata, findings and dates it contains — no extra model call — and Legal Watch is computed
 * from that stored data on read, so the same deadline can never raise two alerts.
 */
import { prisma } from "../../../config/prisma.js";
import { Agent, Prisma } from "../../../../prisma/generated/prisma/client.js";
import { aiService } from "../../../common/utils/aiService.js";
import type { AnalyzeContractResponse } from "./lex.types.js";

type Analysis = AnalyzeContractResponse["analysis"];

// ── Preferences ──────────────────────────────────────────────────────────────

export interface PreferenceField {
  key: string;
  label: string;
  category: "commercial" | "legal" | "style";
  placeholder: string;
}

/** The positions Lex asks about. Values are free text; empty means "no preference". */
export const PREFERENCE_FIELDS: PreferenceField[] = [
  { key: "payment_terms", label: "Payment terms", category: "commercial", placeholder: "e.g. Net 30" },
  { key: "liability", label: "Liability", category: "commercial", placeholder: "e.g. Capped at fees paid in the last 12 months" },
  { key: "termination_notice", label: "Termination notice", category: "commercial", placeholder: "e.g. 30 days, mutual" },
  { key: "jurisdiction", label: "Governing law & courts", category: "legal", placeholder: "e.g. Laws of India, courts in Bengaluru" },
  { key: "dispute_resolution", label: "Dispute resolution", category: "legal", placeholder: "e.g. Arbitration with a mutually appointed arbitrator" },
  { key: "ip_ownership", label: "IP ownership", category: "legal", placeholder: "e.g. We own commissioned deliverables" },
  { key: "confidentiality_period", label: "Confidentiality period", category: "style", placeholder: "e.g. 3 years after the agreement ends" },
  { key: "renewal", label: "Renewal", category: "style", placeholder: "e.g. No auto-renewal" },
  { key: "indemnity", label: "Indemnity", category: "style", placeholder: "e.g. Mutual, limited to third-party claims" },
];

export const listPreferences = async (organizationId: string) => {
  const rows = await prisma.lexPreference.findMany({ where: { organizationId } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return PREFERENCE_FIELDS.map((f) => ({
    ...f,
    value: byKey.get(f.key)?.value ?? "",
    updatedAt: byKey.get(f.key)?.updatedAt.toISOString() ?? null,
  }));
};

/** Preferences with a value, in the shape the AI review prompt reads. */
export const activePreferences = async (organizationId: string) =>
  (await listPreferences(organizationId))
    .filter((p) => p.value.trim())
    .map((p) => ({ key: p.key, label: p.label, value: p.value.trim() }));

export const savePreferences = async (
  organizationId: string,
  values: Record<string, string>,
  actor: { userId: string }
) => {
  const fields = new Map(PREFERENCE_FIELDS.map((f) => [f.key, f]));
  const changed: string[] = [];
  for (const [rawKey, raw] of Object.entries(values)) {
    // Clients send keys hyphenated ("payment-terms") so the body camelizer leaves them alone.
    const key = rawKey.replace(/-/g, "_");
    const field = fields.get(key);
    if (!field) continue;
    const value = raw.trim().slice(0, 300);
    const existing = await prisma.lexPreference.findUnique({ where: { organizationId_key: { organizationId, key } } });
    if (!value) {
      if (existing) {
        await prisma.lexPreference.delete({ where: { id: existing.id } });
        changed.push(field.label);
      }
      continue;
    }
    if (existing?.value === value) continue;
    await prisma.lexPreference.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, label: field.label, category: field.category, value },
      update: { value, label: field.label, category: field.category, source: "manual" },
    });
    changed.push(field.label);
  }
  if (changed.length) {
    await logActivity({
      organizationId,
      actor: "user",
      userId: actor.userId,
      action: "Updated preferences",
      detail: changed.join(", "),
    });
  }
  return listPreferences(organizationId);
};

// ── Activity ─────────────────────────────────────────────────────────────────

export const logActivity = async (input: {
  organizationId: string;
  sourceRowId?: string | null;
  actor: "lex" | "user";
  userId?: string;
  action: string;
  detail?: string;
}) => {
  try {
    let actorName: string | null = null;
    if (input.actor === "user" && input.userId) {
      const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } });
      actorName = user?.name ?? null;
    }
    await prisma.lexActivity.create({
      data: {
        organizationId: input.organizationId,
        sourceRowId: input.sourceRowId ?? null,
        actor: input.actor,
        actorName,
        action: input.action.slice(0, 120),
        detail: (input.detail ?? "").slice(0, 500),
      },
    });
  } catch (err) {
    // The audit trail must never fail the action it records.
    console.warn("[lex] activity log failed", err);
  }
};

// ── Dates ────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const RECURRENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const startOfToday = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * The next due date for a contract date, when it can be worked out: the stated calendar date,
 * else the contract start plus the stated offset; for recurring duties, the next occurrence on
 * or after today. Returns null rather than guessing.
 */
export const computeDueDate = (
  item: { date?: string | null; days_from_start?: number | null; recurrence?: string },
  start: Date | null,
  now = new Date()
): Date | null => {
  const stated = parseIsoDate(item.date);
  const base = stated ?? (start && item.days_from_start != null ? new Date(start.getTime() + item.days_from_start * DAY_MS) : null);
  const months = RECURRENCE_MONTHS[item.recurrence ?? "once"];
  if (!months) return base;
  let next = base ?? start;
  if (!next) return null;
  const today = startOfToday(now);
  for (let i = 0; i < 600 && next < today; i++) next = addMonths(next, months);
  return next;
};

// ── Saving a review ──────────────────────────────────────────────────────────

const findingCategory = (kind: string) =>
  kind === "missing" ? "missing_information" : kind === "preference_mismatch" ? "company_preference_mismatch" : "document_risk";

type ReviewIssue = {
  severity?: string; kind?: string; category?: string; title?: string; section?: string;
  quote?: string; what_it_means?: string; send_back?: string; preference?: string;
};
type ReviewDate = {
  when?: string; what?: string; owner?: string; section?: string; recurrence?: string;
  date?: string | null; days_from_start?: number | null;
};
type ReviewContract = {
  effective_date?: string | null; expiry_date?: string | null; renewal_date?: string | null;
  notice_deadline?: string | null; auto_renewal?: boolean | null; value?: string | null;
  currency?: string | null; payment_terms?: string | null; dispute_resolution?: string | null;
};

/**
 * Store a completed review against its document: contract metadata, findings, dates and the
 * cached review itself. Dates keep their status and reminder choice across re-reviews.
 */
export const saveReview = async (input: {
  organizationId: string;
  userId: string;
  sourceId: string;
  analysis: Analysis;
  actor: "lex" | "user";
}) => {
  const a = input.analysis as Analysis & { contract?: ReviewContract | null; issues?: ReviewIssue[]; key_dates?: ReviewDate[] };
  if (a.failed) return null;
  const source = await prisma.lexSource.findFirst({
    where: { sourceId: input.sourceId, userId: input.userId, organizationId: input.organizationId, agent: Agent.LEX },
  });
  if (!source) return null;

  const contract = a.contract ?? {};
  const issues = (a.issues ?? []) as ReviewIssue[];
  const dates = (a.key_dates ?? []) as ReviewDate[];
  const effectiveDate = parseIsoDate(contract.effective_date) ?? source.effectiveDate;

  await prisma.$transaction(async (tx) => {
    await tx.lexSource.update({
      where: { id: source.id },
      data: {
        counterparty: a.counterparty || source.counterparty,
        perspective: a.perspective || source.perspective,
        effectiveDate,
        expiryDate: parseIsoDate(contract.expiry_date) ?? source.expiryDate,
        renewalDate: parseIsoDate(contract.renewal_date) ?? source.renewalDate,
        noticeDeadline: parseIsoDate(contract.notice_deadline) ?? source.noticeDeadline,
        autoRenewal: contract.auto_renewal ?? source.autoRenewal,
        contractValue: contract.value ?? source.contractValue,
        currency: contract.currency ?? source.currency,
        paymentTerms: contract.payment_terms ?? source.paymentTerms,
        disputeResolution: contract.dispute_resolution ?? source.disputeResolution,
        governingLaw: a.governing_law && a.governing_law !== "Not specified" ? a.governing_law : source.governingLaw,
        jurisdiction: a.jurisdiction && a.jurisdiction !== "Not specified" ? a.jurisdiction : source.jurisdiction,
        typeDetected: source.typeDetected ?? a.document_type,
        review: a as unknown as Prisma.InputJsonValue,
        reviewHeadline: a.verdict?.headline ?? null,
        reviewAction: a.verdict?.action ?? a.recommended_action,
        riskLevel: a.risk_level,
        criticalCount: issues.filter((i) => i.severity === "critical").length,
        highCount: issues.filter((i) => i.severity === "high").length,
        lastReviewedAt: new Date(),
      },
    });

    await tx.lexFinding.deleteMany({ where: { sourceRowId: source.id } });
    if (issues.length) {
      await tx.lexFinding.createMany({
        data: issues.map((i) => ({
          organizationId: input.organizationId,
          sourceRowId: source.id,
          severity: i.severity ?? "medium",
          category: i.category ?? findingCategory(i.kind ?? "risk"),
          kind: i.kind ?? "risk",
          title: (i.title ?? "").slice(0, 200),
          section: (i.section ?? "").slice(0, 100),
          quote: (i.quote ?? "").slice(0, 1000),
          explanation: (i.what_it_means ?? "").slice(0, 1000),
          suggestedWording: (i.send_back ?? "").slice(0, 1500),
          preference: i.preference || null,
        })),
      });
    }

    // Keep dates the user already acted on; refresh their wording-derived fields; add new ones;
    // retire open dates the new review no longer mentions.
    const existing = await tx.lexObligation.findMany({ where: { sourceRowId: source.id } });
    const seen = new Set<string>();
    for (const d of dates) {
      if (!d.what || !d.when) continue;
      const description = d.what.slice(0, 300);
      const whenText = d.when.slice(0, 120);
      const key = `${description} ${whenText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dueDate = computeDueDate(d, effectiveDate);
      await tx.lexObligation.upsert({
        where: { sourceRowId_description_whenText: { sourceRowId: source.id, description, whenText } },
        create: {
          organizationId: input.organizationId,
          sourceRowId: source.id,
          owner: d.owner ?? "you",
          description,
          whenText,
          section: (d.section ?? "").slice(0, 100),
          recurrence: d.recurrence ?? "once",
          dueDate,
        },
        update: { owner: d.owner ?? "you", section: (d.section ?? "").slice(0, 100), recurrence: d.recurrence ?? "once", dueDate },
      });
    }
    const stale = existing.filter((o) => o.status === "open" && !o.reminderOn && !seen.has(`${o.description} ${o.whenText}`));
    if (stale.length) {
      await tx.lexObligation.deleteMany({ where: { id: { in: stale.map((o) => o.id) } } });
    }
  });

  const serious = issues.filter((i) => i.severity === "critical" || i.severity === "high").length;
  await logActivity({
    organizationId: input.organizationId,
    sourceRowId: source.id,
    actor: "lex",
    action: `Reviewed ${source.name}`,
    detail: a.verdict?.headline ?? "",
  });
  if (serious) {
    await logActivity({
      organizationId: input.organizationId,
      sourceRowId: source.id,
      actor: "lex",
      action: `Found ${serious} high-priority ${serious === 1 ? "issue" : "issues"}`,
      detail: issues.filter((i) => i.severity === "critical" || i.severity === "high").map((i) => i.title).join("; "),
    });
  }
  return source.id;
};

// ── Reminders ────────────────────────────────────────────────────────────────

/** Turn reminders on for chosen dates; a start date fills in dates that were relative to it. */
export const enableReminders = async (input: {
  organizationId: string;
  userId: string;
  sourceRowId: string;
  obligationIds: string[];
  startDate?: string | null;
}) => {
  const source = await prisma.lexSource.findFirst({
    where: { id: input.sourceRowId, userId: input.userId, organizationId: input.organizationId },
    select: { id: true, name: true, effectiveDate: true, review: true },
  });
  if (!source) return null;

  const start = parseIsoDate(input.startDate) ?? source.effectiveDate;
  if (start && !source.effectiveDate) {
    await prisma.lexSource.update({ where: { id: source.id }, data: { effectiveDate: start } });
  }
  const reviewDates = ((source.review as { key_dates?: ReviewDate[] } | null)?.key_dates ?? []);
  const obligations = await prisma.lexObligation.findMany({
    where: { sourceRowId: source.id, id: { in: input.obligationIds } },
  });
  for (const o of obligations) {
    const match = reviewDates.find((d) => d.what?.slice(0, 300) === o.description && d.when?.slice(0, 120) === o.whenText);
    const dueDate = o.dueDate ?? (match ? computeDueDate(match, start) : null);
    await prisma.lexObligation.update({ where: { id: o.id }, data: { reminderOn: true, dueDate } });
  }
  await logActivity({
    organizationId: input.organizationId,
    sourceRowId: source.id,
    actor: "user",
    userId: input.userId,
    action: `Added ${obligations.length} ${obligations.length === 1 ? "date" : "dates"} to reminders`,
    detail: obligations.map((o) => o.description).join("; "),
  });
  return prisma.lexObligation.findMany({ where: { sourceRowId: source.id }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
};

export const updateObligation = async (input: {
  organizationId: string;
  userId: string;
  id: string;
  status?: "open" | "done" | "dismissed";
  reminderOn?: boolean;
}) => {
  const o = await prisma.lexObligation.findFirst({
    where: { id: input.id, organizationId: input.organizationId, source: { userId: input.userId } },
  });
  if (!o) return null;
  const updated = await prisma.lexObligation.update({
    where: { id: o.id },
    data: { ...(input.status ? { status: input.status } : {}), ...(input.reminderOn !== undefined ? { reminderOn: input.reminderOn } : {}) },
  });
  if (input.status && input.status !== o.status) {
    await logActivity({
      organizationId: input.organizationId,
      sourceRowId: o.sourceRowId,
      actor: "user",
      userId: input.userId,
      action: input.status === "done" ? "Marked a date done" : input.status === "dismissed" ? "Dismissed a date" : "Reopened a date",
      detail: o.description,
    });
  }
  return updated;
};

// ── Versions ─────────────────────────────────────────────────────────────────

const VERSION_NOISE = /\b(v(ersion)?\s*\d+(\.\d+)*|final|draft|revised|updated|signed|copy|new|latest|clean|redline[d]?|\d{1,4}[-_/.]\d{1,2}([-_/.]\d{1,4})?)\b/gi;

export const normaliseDocumentName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.(pdf|docx?)$/i, "")
    .replace(VERSION_NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Earlier documents that look like previous versions of a new upload, best match first. */
export const findVersionCandidates = async (userId: string, organizationId: string, name: string) => {
  const target = normaliseDocumentName(name);
  if (!target) return [];
  const targetWords = new Set(target.split(" ").filter((w) => w.length > 2));
  const rows = await prisma.lexSource.findMany({
    where: { userId, organizationId, agent: Agent.LEX },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, version: true, createdAt: true, counterparty: true },
    take: 200,
  });
  return rows
    .map((r) => {
      const words = new Set(normaliseDocumentName(r.name).split(" ").filter((w) => w.length > 2));
      const overlap = [...targetWords].filter((w) => words.has(w)).length;
      const score = overlap / Math.max(1, Math.max(targetWords.size, words.size));
      return { ...r, score };
    })
    .filter((r) => r.score >= 0.6)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(({ score: _score, ...r }) => ({ ...r, createdAt: r.createdAt.toISOString() }));
};

export const compareWithPreviousVersion = async (input: {
  organizationId: string;
  userId: string;
  sourceRowId: string;
  force?: boolean;
}) => {
  const current = await prisma.lexSource.findFirst({
    where: { id: input.sourceRowId, userId: input.userId, organizationId: input.organizationId },
  });
  if (!current?.previousVersionId) return null;
  if (current.versionComparison && !input.force) return current.versionComparison;
  const previous = await prisma.lexSource.findFirst({
    where: { id: current.previousVersionId, organizationId: input.organizationId },
  });
  if (!previous) return null;

  const { data } = await aiService.post("/ai/lex/compare-versions", {
    previous_user_id: previous.userId,
    previous_source_id: previous.sourceId,
    current_user_id: current.userId,
    current_source_id: current.sourceId,
    perspective: current.perspective ?? previous.perspective ?? "",
    preferences: await activePreferences(input.organizationId),
  });
  const comparison = { ...(data as object), previousName: previous.name, previousReviewedAt: previous.lastReviewedAt?.toISOString() ?? null, comparedAt: new Date().toISOString() };
  const failed = (data as { failed?: boolean }).failed;
  if (!failed) {
    await prisma.lexSource.update({
      where: { id: current.id },
      data: { versionComparison: comparison as Prisma.InputJsonValue, versionComparisonSeen: false },
    });
    const changes = ((data as { changes?: unknown[] }).changes ?? []).length;
    await logActivity({
      organizationId: input.organizationId,
      sourceRowId: current.id,
      actor: "lex",
      action: `Compared with ${previous.name}`,
      detail: `${changes} material ${changes === 1 ? "change" : "changes"}`,
    });
  }
  return comparison;
};

// ── Legal Watch ──────────────────────────────────────────────────────────────

export type WatchSeverity = "critical" | "high" | "medium" | "info";

export interface WatchItem {
  id: string;
  kind: "deadline" | "notice" | "renewal" | "expiry" | "new_version" | "needs_review";
  severity: WatchSeverity;
  sourceRowId: string;
  documentName: string;
  title: string;
  dueDate: string | null;
  daysLeft: number | null;
}

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

const deadlineSeverity = (days: number): WatchSeverity => (days < 0 ? "critical" : days <= 7 ? "high" : "medium");

const dueText = (days: number) =>
  days < 0 ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue` : days === 0 ? "due today" : `in ${days} ${days === 1 ? "day" : "days"}`;

export const buildWatch = async (userId: string, organizationId: string, now = new Date()) => {
  const today = startOfToday(now);
  const [sources, obligations] = await Promise.all([
    prisma.lexSource.findMany({
      where: { userId, organizationId, agent: Agent.LEX, status: "active" },
      select: {
        id: true, name: true, lastReviewedAt: true, reviewHeadline: true, reviewAction: true, riskLevel: true,
        criticalCount: true, highCount: true, expiryDate: true, renewalDate: true, noticeDeadline: true,
        versionComparison: true, versionComparisonSeen: true, createdAt: true, counterparty: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lexObligation.findMany({
      where: {
        organizationId,
        status: "open",
        owner: { in: ["you", "both"] },
        dueDate: { gte: new Date(today.getTime() - 30 * DAY_MS), lte: new Date(today.getTime() + 30 * DAY_MS) },
        source: { userId, status: "active" },
      },
      include: { source: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const items: WatchItem[] = [];
  const seenDates = new Set<string>();

  for (const o of obligations) {
    if (!o.dueDate) continue;
    const days = daysBetween(today, o.dueDate);
    seenDates.add(`${o.sourceRowId}:${o.dueDate.toISOString().slice(0, 10)}`);
    items.push({
      id: `obligation:${o.id}`,
      kind: "deadline",
      severity: deadlineSeverity(days),
      sourceRowId: o.sourceRowId,
      documentName: o.source.name,
      title: `${o.description} — ${dueText(days)}`,
      dueDate: o.dueDate.toISOString(),
      daysLeft: days,
    });
  }

  for (const s of sources) {
    const contractDates: [WatchItem["kind"], Date | null, string, number][] = [
      ["notice", s.noticeDeadline, "Notice deadline", 45],
      ["renewal", s.renewalDate, "Renewal", 60],
      ["expiry", s.expiryDate, "Agreement ends", 60],
    ];
    for (const [kind, date, label, window] of contractDates) {
      if (!date) continue;
      const days = daysBetween(today, date);
      const key = `${s.id}:${date.toISOString().slice(0, 10)}`;
      if (days < -7 || days > window || seenDates.has(key)) continue;
      seenDates.add(key);
      items.push({
        id: `${kind}:${s.id}`,
        kind,
        severity: kind === "notice" ? deadlineSeverity(Math.min(days, 7)) : days < 0 ? "high" : "medium",
        sourceRowId: s.id,
        documentName: s.name,
        title: `${label} ${dueText(days)}`,
        dueDate: date.toISOString(),
        daysLeft: days,
      });
    }

    const comparison = s.versionComparison as { changes?: { severity?: string }[]; previousName?: string } | null;
    if (comparison && !s.versionComparisonSeen) {
      const changes = comparison.changes ?? [];
      items.push({
        id: `version:${s.id}`,
        kind: "new_version",
        severity: changes.some((c) => c.severity === "critical") ? "critical" : "high",
        sourceRowId: s.id,
        documentName: s.name,
        title: `New version — ${changes.length} ${changes.length === 1 ? "change" : "changes"} from ${comparison.previousName ?? "the previous version"}`,
        dueDate: null,
        daysLeft: null,
      });
    }

    if (!s.lastReviewedAt) {
      items.push({
        id: `review:${s.id}`,
        kind: "needs_review",
        severity: "info",
        sourceRowId: s.id,
        documentName: s.name,
        title: "Not reviewed yet",
        dueDate: null,
        daysLeft: null,
      });
    }
  }

  const rank: Record<WatchSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };
  items.sort((x, y) => rank[x.severity] - rank[y.severity] || (x.daysLeft ?? 999) - (y.daysLeft ?? 999));
  const attention = items.filter((i) => i.severity !== "info");

  return {
    monitored: sources.filter((s) => s.lastReviewedAt).length,
    documents: sources.length,
    attentionCount: attention.length,
    items,
    recentlyReviewed: sources
      .filter((s) => s.lastReviewedAt)
      .sort((x, y) => (y.lastReviewedAt!.getTime() - x.lastReviewedAt!.getTime()))
      .slice(0, 5)
      .map((s) => ({
        sourceRowId: s.id,
        name: s.name,
        headline: s.reviewHeadline,
        action: s.reviewAction,
        seriousCount: s.criticalCount + s.highCount,
        reviewedAt: s.lastReviewedAt!.toISOString(),
      })),
  };
};

// ── Legal Brief ──────────────────────────────────────────────────────────────

export const buildBrief = async (userId: string, organizationId: string, now = new Date()) => {
  const watch = await buildWatch(userId, organizationId, now);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const reviewedThisWeek = await prisma.lexSource.count({
    where: { userId, organizationId, agent: Agent.LEX, lastReviewedAt: { gte: weekAgo } },
  });
  const upcoming = watch.items.filter((i) => i.daysLeft !== null && i.daysLeft >= 0 && i.daysLeft <= 30);
  const attention = watch.items.filter((i) => i.severity === "critical" || i.severity === "high");
  return {
    generatedAt: now.toISOString(),
    attentionCount: attention.length,
    upcomingCount: upcoming.length,
    reviewedThisWeek,
    monitored: watch.monitored,
    attention: attention.slice(0, 5),
    upcoming: upcoming.slice(0, 8),
    clear: attention.length === 0 && upcoming.length === 0,
  };
};

// ── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async (organizationId: string) => {
  const row = await prisma.lexSettings.findUnique({ where: { organizationId } });
  return { weeklyBrief: row?.weeklyBrief ?? false, lastBriefAt: row?.lastBriefAt?.toISOString() ?? null };
};

export const saveSettings = async (organizationId: string, userId: string, input: { weeklyBrief: boolean }) => {
  const before = await getSettings(organizationId);
  await prisma.lexSettings.upsert({
    where: { organizationId },
    create: { organizationId, weeklyBrief: input.weeklyBrief },
    update: { weeklyBrief: input.weeklyBrief },
  });
  if (before.weeklyBrief !== input.weeklyBrief) {
    await logActivity({
      organizationId,
      actor: "user",
      userId,
      action: input.weeklyBrief ? "Turned on the weekly Legal Brief" : "Turned off the weekly Legal Brief",
    });
  }
  return getSettings(organizationId);
};

// ── Chat context ─────────────────────────────────────────────────────────────

const CHAT_CONTEXT_CHARS = 3000;

/**
 * A compact, factual summary of the user's legal memory for Lex's chat turns, so questions like
 * "what needs my attention?" or "what's due this month?" are answered from stored data rather
 * than guessed. Built from the database — no model call.
 */
export const buildLegalMemoryContext = async (userId: string, organizationId: string) => {
  const [watch, documents] = await Promise.all([
    buildWatch(userId, organizationId),
    prisma.lexSource.findMany({
      where: { userId, organizationId, agent: Agent.LEX, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        name: true, sourceId: true, counterparty: true, reviewHeadline: true, lastReviewedAt: true,
        expiryDate: true, renewalDate: true, criticalCount: true, highCount: true, version: true,
      },
    }),
  ]);
  if (!documents.length) return "";
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const docLines = documents.map((d) => {
    const bits = [
      `"${d.name}" (source_id ${d.sourceId}${d.version > 1 ? `, v${d.version}` : ""})`,
      d.counterparty ? `with ${d.counterparty}` : null,
      d.lastReviewedAt ? `review: ${d.reviewHeadline ?? "done"}${d.criticalCount + d.highCount ? `, ${d.criticalCount + d.highCount} high-priority issues` : ""}` : "not reviewed",
      d.expiryDate ? `expires ${day(d.expiryDate)}` : null,
      d.renewalDate ? `renews ${day(d.renewalDate)}` : null,
    ].filter(Boolean);
    return `- ${bits.join("; ")}`;
  });
  const attention = watch.items
    .filter((i) => i.severity !== "info")
    .slice(0, 10)
    .map((i) => `- ${i.documentName}: ${i.title}${i.dueDate ? ` (${i.dueDate.slice(0, 10)})` : ""}`);
  const block = [
    "## Lex legal memory (from the user's stored documents — use it for questions about their documents, deadlines and what needs attention; say so when something isn't in it)",
    `Today: ${new Date().toISOString().slice(0, 10)}. ${watch.monitored} reviewed, ${documents.length} documents.`,
    attention.length ? `Needs attention:\n${attention.join("\n")}` : "Needs attention: nothing right now.",
    `Documents:\n${docLines.join("\n")}`,
  ].join("\n");
  return `${block.slice(0, CHAT_CONTEXT_CHARS)}\n\n---\n\n`;
};
