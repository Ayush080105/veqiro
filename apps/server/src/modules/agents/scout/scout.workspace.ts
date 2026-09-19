import { prisma } from "../../../config/prisma.js";
import {
  ActorKind,
  Agent,
  FindingConfidence,
  ResearchStatus,
  WorkObjectStatus,
} from "../../../../prisma/generated/prisma/client.js";
import { recordActivityEvent } from "../../activity/activity-event.service.js";
import {
  projectWorkObject,
  reprojectAll,
  unprojectWorkObject,
} from "../../workspace/work-objects.projector.js";

/**
 * Scout's bridge into the workspace framework.
 *
 * The interesting part is captureResearch: Scout's existing endpoints already
 * return sources and conclusions, they were just thrown away after rendering.
 * This keeps them, without changing how the research itself is done.
 */

export const SCOUT_KINDS = {
  project: "scout.project",
} as const;

const STATUS_BY_RESEARCH_STATUS: Record<ResearchStatus, WorkObjectStatus> = {
  BRIEF: WorkObjectStatus.DRAFT,
  RESEARCHING: WorkObjectStatus.ACTIVE,
  // Findings exist and nobody has read them yet — the "waiting for you" case.
  READY: WorkObjectStatus.NEEDS_REVIEW,
  CLOSED: WorkObjectStatus.DONE,
  ARCHIVED: WorkObjectStatus.ARCHIVED,
};

type ProjectRow = Awaited<ReturnType<typeof prisma.researchProject.findMany>>[number];

function researchToWorkObject(project: ProjectRow) {
  return {
    organizationId: project.organizationId,
    agent: Agent.SCOUT,
    kind: SCOUT_KINDS.project,
    sourceId: project.id,
    title: project.title,
    status: STATUS_BY_RESEARCH_STATUS[project.status],
    dueAt: null,
    ownerUserId: project.userId,
    preview: {
      question: project.question,
      subjectCompany: project.subjectCompany,
      monitored: project.monitored,
      summary: project.summary?.slice(0, 200) ?? null,
    },
    sourceUpdatedAt: project.lastResearchedAt ?? project.updatedAt,
  };
}

export async function projectResearchProject(projectId: string): Promise<void> {
  // projection-guard: bookkeeping must never fail the research that triggered it.
  try {
    const project = await prisma.researchProject.findUnique({ where: { id: projectId } });
    if (!project) {
      await unprojectWorkObject(SCOUT_KINDS.project, projectId);
      return;
    }
    await projectWorkObject(researchToWorkObject(project));
  } catch (err) {
    console.error("[scout] projection failed", projectId, err);
  }
}

export async function reindexResearchProjects(organizationId?: string) {
  const rows = await prisma.researchProject.findMany({
    where: organizationId ? { organizationId } : undefined,
  });
  return reprojectAll(SCOUT_KINDS.project, rows.map(researchToWorkObject), organizationId);
}

/** A source as Scout's research endpoints already return it. */
export interface CapturedSource {
  title?: string | null;
  url?: string | null;
  publisher?: string | null;
  snippet?: string | null;
  published_at?: string | null;
}

/**
 * Turn one research run into a durable project.
 *
 * Best-effort throughout: the customer already has their answer on screen by
 * the time this runs, and losing the bookkeeping is a far smaller failure than
 * turning a successful piece of research into an error.
 */
export async function captureResearch(input: {
  organizationId: string;
  userId: string;
  question: string;
  title?: string;
  subjectCompany?: string | null;
  summary?: string | null;
  sources?: CapturedSource[];
  findings?: { statement: string; confidence?: FindingConfidence; category?: string }[];
}): Promise<string | null> {
  try {
    const title = (input.title ?? input.question).trim();

    const project = await prisma.researchProject.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        title: title.length > 120 ? `${title.slice(0, 117)}...` : title,
        question: input.question,
        subjectCompany: input.subjectCompany ?? null,
        summary: input.summary ?? null,
        status: ResearchStatus.READY,
        lastResearchedAt: new Date(),
      },
    });

    // Sources carry a url unique per project, so a re-run updates rather than
    // duplicating. Anything without a url cannot be cited or re-checked, so it
    // is not worth a row.
    const sources = (input.sources ?? []).filter((s) => Boolean(s.url));
    for (const source of sources) {
      const publishedAt = source.published_at ? new Date(source.published_at) : null;
      await prisma.researchSource.upsert({
        where: { projectId_url: { projectId: project.id, url: source.url! } },
        create: {
          organizationId: input.organizationId,
          projectId: project.id,
          title: source.title ?? source.url!,
          url: source.url!,
          publisher: source.publisher ?? null,
          publishedAt:
            publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
          snippet: source.snippet ?? "",
        },
        update: { snippet: source.snippet ?? "", retrievedAt: new Date() },
      });
    }

    for (const finding of input.findings ?? []) {
      if (!finding.statement?.trim()) continue;
      await prisma.researchFinding.create({
        data: {
          organizationId: input.organizationId,
          projectId: project.id,
          statement: finding.statement,
          confidence: finding.confidence ?? FindingConfidence.MEDIUM,
          category: finding.category ?? "",
        },
      });
    }

    await projectResearchProject(project.id);
    await recordActivityEvent({
      organizationId: input.organizationId,
      agent: Agent.SCOUT,
      actorKind: ActorKind.AGENT,
      actorUserId: input.userId,
      verb: "scout.research.completed",
      summary: `Researched "${project.title}" across ${sources.length} ${
        sources.length === 1 ? "source" : "sources"
      }`,
      objectKind: SCOUT_KINDS.project,
      objectId: project.id,
    });

    return project.id;
  } catch (err) {
    console.error("[scout] research capture failed (continuing)", err);
    return null;
  }
}
