import { prisma } from "../../../config/prisma.js";
import {
  ActorKind,
  Agent,
  InsightSeverity,
  SeoIssueSeverity,
  SeoIssueStatus,
  WorkObjectStatus,
} from "../../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../../activity/activity-event.service.js";
import { upsertInsight } from "../../workspace/insights.service.js";
import {
  projectWorkObject,
  reprojectAll,
} from "../../workspace/work-objects.projector.js";

/**
 * Turning Sage's audits into monitoring.
 *
 * The audit itself is unchanged — this takes what it already returns and gives
 * it somewhere to live, so the second audit of a page can say something the
 * first could not: whether it got better, and whether the things you fixed
 * stayed fixed.
 */

export const SAGE_KINDS = {
  page: "sage.page",
} as const;

/** The audit fields this needs, structurally. */
export interface PageAuditLike {
  url: string;
  target_keyword?: string;
  overall_score?: number;
  mentor_summary?: string;
  next_move?: string;
  critical_issues?: string[];
  high_priority?: string[];
  medium_priority?: string[];
  quick_wins?: string[];
}

const SEVERITY_BUCKETS: [SeoIssueSeverity, keyof PageAuditLike][] = [
  [SeoIssueSeverity.CRITICAL, "critical_issues"],
  [SeoIssueSeverity.HIGH, "high_priority"],
  [SeoIssueSeverity.MEDIUM, "medium_priority"],
  [SeoIssueSeverity.QUICK_WIN, "quick_wins"],
];

type PageRow = Awaited<ReturnType<typeof prisma.seoPage.findMany>>[number];

function pageToWorkObject(page: PageRow, openIssues: number) {
  return {
    organizationId: page.organizationId,
    agent: Agent.SAGE,
    kind: SAGE_KINDS.page,
    sourceId: page.id,
    title: page.title || page.url,
    // A page with open problems is work; one that is clean is just a record.
    status: openIssues > 0 ? WorkObjectStatus.NEEDS_REVIEW : WorkObjectStatus.ACTIVE,
    dueAt: null,
    ownerUserId: null,
    preview: {
      url: page.url,
      score: page.score,
      previousScore: page.previousScore,
      targetKeyword: page.targetKeyword,
      openIssues,
      nextMove: page.nextMove,
    },
    sourceUpdatedAt: page.lastAuditedAt ?? page.updatedAt,
  };
}

/**
 * Record one page audit.
 *
 * Best-effort: the customer has their audit on screen already, and losing the
 * bookkeeping must not turn a successful audit into an error.
 */
export async function capturePageAudit(
  organizationId: string,
  userId: string,
  audit: PageAuditLike,
): Promise<void> {
  try {
    if (!audit?.url) return;

    const existing = await prisma.seoPage.findUnique({
      where: { organizationId_url: { organizationId, url: audit.url } },
    });

    const page = await prisma.seoPage.upsert({
      where: { organizationId_url: { organizationId, url: audit.url } },
      create: {
        organizationId,
        url: audit.url,
        targetKeyword: audit.target_keyword ?? "",
        score: audit.overall_score ?? null,
        summary: audit.mentor_summary ?? "",
        nextMove: audit.next_move ?? "",
        lastAuditedAt: new Date(),
      },
      update: {
        targetKeyword: audit.target_keyword ?? existing?.targetKeyword ?? "",
        score: audit.overall_score ?? null,
        // Yesterday's score becomes the comparison point, which is the whole
        // reason to keep the page rather than just the audit.
        previousScore: existing?.score ?? null,
        summary: audit.mentor_summary ?? "",
        nextMove: audit.next_move ?? "",
        lastAuditedAt: new Date(),
      },
    });

    const seen = new Set<string>();
    let reopened = 0;

    for (const [severity, key] of SEVERITY_BUCKETS) {
      for (const description of (audit[key] as string[] | undefined) ?? []) {
        const text = description?.trim();
        if (!text) continue;
        seen.add(text);

        const prior = await prisma.seoIssue.findUnique({
          where: { pageId_description: { pageId: page.id, description: text } },
        });

        // An issue reported again after being marked fixed means the fix did
        // not take. That is worth counting rather than silently reopening.
        if (prior?.status === SeoIssueStatus.FIXED) reopened += 1;

        await prisma.seoIssue.upsert({
          where: { pageId_description: { pageId: page.id, description: text } },
          create: {
            organizationId,
            pageId: page.id,
            severity,
            description: text,
          },
          update: {
            severity,
            lastSeenAt: new Date(),
            // Ignored stays ignored: the customer already decided.
            ...(prior?.status === SeoIssueStatus.IGNORED
              ? {}
              : { status: SeoIssueStatus.OPEN, resolvedAt: null }),
          },
        });
      }
    }

    // Anything previously open that this audit no longer reports has been
    // fixed, whether or not anyone said so.
    const vanished = await prisma.seoIssue.findMany({
      where: {
        pageId: page.id,
        status: SeoIssueStatus.OPEN,
        description: { notIn: [...seen] },
      },
      select: { id: true },
    });
    if (vanished.length > 0) {
      await prisma.seoIssue.updateMany({
        where: { id: { in: vanished.map((v) => v.id) } },
        data: { status: SeoIssueStatus.FIXED, resolvedAt: new Date() },
      });
    }

    const openIssues = await prisma.seoIssue.count({
      where: { pageId: page.id, status: SeoIssueStatus.OPEN },
    });

    await projectWorkObject(pageToWorkObject(page, openIssues));

    // A page that got worse is the finding worth surfacing. A page that
    // improved is good news nobody needs an alert about.
    const dropped =
      page.previousScore !== null &&
      page.score !== null &&
      page.score < page.previousScore - 5;

    if (dropped) {
      await upsertInsight({
        organizationId,
        agent: Agent.SAGE,
        dedupeKey: `sage.score-drop:${page.id}:${new Date().toISOString().slice(0, 10)}`,
        kind: "sage.score-drop",
        title: `${page.title || page.url} dropped from ${page.previousScore} to ${page.score}`,
        body: page.nextMove || "",
        severity: InsightSeverity.HIGH,
        suggestedActionId: "sage:page-seo-audit",
        suggestedArgs: { url: page.url },
        objectKind: SAGE_KINDS.page,
        objectId: page.id,
      });
    }

    await recordActivityEvent({
      organizationId,
      agent: Agent.SAGE,
      actorKind: ActorKind.AGENT,
      actorUserId: userId,
      verb: "sage.page.audited",
      summary:
        `Audited ${page.url}` +
        (page.score !== null ? ` — scored ${page.score}` : "") +
        (reopened > 0 ? `, ${reopened} previously-fixed issue(s) came back` : ""),
      objectKind: SAGE_KINDS.page,
      objectId: page.id,
    });
  } catch (err) {
    console.error("[sage] page capture failed (continuing)", err);
  }
}

/** Record a whole site audit, one page at a time. */
export async function captureSiteAudit(
  organizationId: string,
  userId: string,
  results: PageAuditLike[],
): Promise<void> {
  for (const audit of results ?? []) {
    await capturePageAudit(organizationId, userId, audit);
  }
}

export async function reindexSeoPages(organizationId?: string) {
  const pages = await prisma.seoPage.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: {
      _count: { select: { issues: { where: { status: SeoIssueStatus.OPEN } } } },
    },
  });
  return reprojectAll(
    SAGE_KINDS.page,
    pages.map((page) => pageToWorkObject(page, page._count.issues)),
    organizationId,
  );
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listSeoPages(organizationId: string) {
  const pages = await prisma.seoPage.findMany({
    where: { organizationId },
    orderBy: [{ score: "asc" }, { lastAuditedAt: "desc" }],
    include: {
      _count: { select: { issues: { where: { status: SeoIssueStatus.OPEN } } } },
    },
    take: 200,
  });

  return pages.map((page) => ({
    id: page.id,
    url: page.url,
    title: page.title,
    targetKeyword: page.targetKeyword,
    score: page.score,
    previousScore: page.previousScore,
    nextMove: page.nextMove,
    openIssues: page._count.issues,
    lastAuditedAt: page.lastAuditedAt?.toISOString() ?? null,
  }));
}

export async function getSeoPage(organizationId: string, id: string) {
  const page = await prisma.seoPage.findUnique({
    where: { id },
    include: {
      issues: {
        orderBy: [{ status: "asc" }, { severity: "asc" }, { lastSeenAt: "desc" }],
      },
    },
  });
  if (!page || page.organizationId !== organizationId) return null;

  return {
    id: page.id,
    url: page.url,
    title: page.title,
    targetKeyword: page.targetKeyword,
    score: page.score,
    previousScore: page.previousScore,
    summary: page.summary,
    nextMove: page.nextMove,
    lastAuditedAt: page.lastAuditedAt?.toISOString() ?? null,
    issues: page.issues.map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      description: issue.description,
      status: issue.status,
      firstSeenAt: issue.firstSeenAt.toISOString(),
      lastSeenAt: issue.lastSeenAt.toISOString(),
    })),
  };
}

/** Mark an issue fixed or ignored. The next audit still gets the final say. */
export async function setIssueStatus(
  organizationId: string,
  issueId: string,
  status: SeoIssueStatus,
) {
  const issue = await prisma.seoIssue.findUnique({ where: { id: issueId } });
  if (!issue || issue.organizationId !== organizationId) return null;

  const updated = await prisma.seoIssue.update({
    where: { id: issueId },
    data: {
      status,
      resolvedAt: status === SeoIssueStatus.OPEN ? null : new Date(),
    },
  });

  const openIssues = await prisma.seoIssue.count({
    where: { pageId: issue.pageId, status: SeoIssueStatus.OPEN },
  });
  const page = await prisma.seoPage.findUnique({ where: { id: issue.pageId } });
  if (page) await projectWorkObject(pageToWorkObject(page, openIssues));

  return { id: updated.id, status: updated.status };
}
