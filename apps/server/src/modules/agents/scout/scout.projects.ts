import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { prisma } from "../../../config/prisma.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import { ResearchStatus } from "../../../../prisma/generated/prisma/client.js";
import { projectResearchProject } from "./scout.workspace.js";

/**
 * Reads over Scout's research projects, plus the two state changes a human
 * makes: closing one they are done with, and asking Scout to keep watching a
 * subject. Creation happens as a side effect of research itself.
 */

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const idParamSchema = z.object({ id: z.string().min(1) });
const listQuerySchema = z.object({
  status: z.nativeEnum(ResearchStatus).optional(),
  monitored: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const patchBodySchema = z.object({
  status: z.nativeEnum(ResearchStatus).optional(),
  monitored: z.boolean().optional(),
});

export const listResearchProjects = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { status, monitored, limit } = listQuerySchema.parse(req.query);

  const rows = await prisma.researchProject.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
      ...(monitored ? { monitored: monitored === "true" } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit ?? 50,
    // Counts rather than the rows themselves: a list does not need every
    // source, and fetching them would make this heavy for no visible gain.
    include: { _count: { select: { sources: true, findings: true } } },
  });

  res.status(StatusCodes.OK).json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      question: row.question,
      status: row.status,
      subjectCompany: row.subjectCompany,
      summary: row.summary,
      monitored: row.monitored,
      sourceCount: row._count.sources,
      findingCount: row._count.findings,
      lastResearchedAt: row.lastResearchedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  );
};

/** The evidence panel: a project with everything it rests on. */
export const getResearchProject = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = idParamSchema.parse(req.params);

  const row = await prisma.researchProject.findUnique({
    where: { id },
    include: {
      sources: { orderBy: { retrievedAt: "desc" } },
      findings: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Research project not found");
  }

  res.status(StatusCodes.OK).json({
    id: row.id,
    title: row.title,
    question: row.question,
    brief: row.brief,
    status: row.status,
    subjectCompany: row.subjectCompany,
    summary: row.summary,
    monitored: row.monitored,
    lastResearchedAt: row.lastResearchedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    sources: row.sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publishedAt: source.publishedAt?.toISOString() ?? null,
      snippet: source.snippet,
      retrievedAt: source.retrievedAt.toISOString(),
    })),
    findings: row.findings.map((finding) => ({
      id: finding.id,
      statement: finding.statement,
      confidence: finding.confidence,
      category: finding.category,
      sourceId: finding.sourceId,
    })),
  });
};

export const patchResearchProject = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const body = patchBodySchema.parse(req.body);

  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError("Research project not found");
  }

  const row = await prisma.researchProject.update({ where: { id }, data: body });
  await projectResearchProject(row.id);

  res.status(StatusCodes.OK).json({
    id: row.id,
    status: row.status,
    monitored: row.monitored,
  });
};
