import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { prisma } from "../../../config/prisma.js";
import { NotFoundError } from "../../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import { CampaignStatus } from "../../../../prisma/generated/prisma/client.js";
import { MAYA_KINDS, projectCampaign, recordMayaEvent } from "./maya.workspace.js";

/**
 * Reads and lifecycle transitions for campaigns.
 *
 * Creation is not here: a campaign comes into existence as a side effect of
 * generation in maya.service.createCampaign, because a campaign with no assets
 * is not a thing anyone wants. What this adds is the rest of the PRD's
 * workflow — approve, schedule, archive — which previously had nowhere to live.
 */

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

const campaignIdParamSchema = z.object({ id: z.string().min(1) });
const listQuerySchema = z.object({
  status: z.nativeEnum(CampaignStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const scheduleBodySchema = z.object({ scheduledFor: z.coerce.date() });

const toDTO = (row: Awaited<ReturnType<typeof prisma.campaign.create>>) => ({
  id: row.id,
  name: row.name,
  brief: row.brief,
  objective: row.objective,
  audience: row.audience,
  platform: row.platform,
  status: row.status,
  productImageUrls: row.productImageUrls,
  assets: row.assets,
  caption: row.caption,
  approvedAt: row.approvedAt?.toISOString() ?? null,
  scheduledFor: row.scheduledFor?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listCampaigns = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { status, limit } = listQuerySchema.parse(req.query);
  const rows = await prisma.campaign.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: limit ?? 50,
  });
  res.status(StatusCodes.OK).json(rows.map(toDTO));
};

const requireCampaign = async (organizationId: string, id: string) => {
  const row = await prisma.campaign.findUnique({ where: { id } });
  if (!row || row.organizationId !== organizationId) {
    throw new NotFoundError("Campaign not found");
  }
  return row;
};

export const getCampaign = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = campaignIdParamSchema.parse(req.params);
  res.status(StatusCodes.OK).json(toDTO(await requireCampaign(organizationId, id)));
};

/**
 * Approve a campaign's assets.
 *
 * The human-control step from the PRD: generation produces assets, a person
 * says yes, and only then does anything leave the building. Recorded with who
 * and when, because "who approved this?" is a question that gets asked.
 */
export const approveCampaign = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = campaignIdParamSchema.parse(req.params);
  const existing = await requireCampaign(organizationId, id);

  const row = await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      status: CampaignStatus.SCHEDULED,
      approvedAt: new Date(),
      approvedByUserId: userId,
    },
  });
  await projectCampaign(row.id);
  await recordMayaEvent({
    organizationId,
    userId,
    verb: "maya.campaign.approved",
    summary: `Approved "${row.name}"`,
    objectKind: MAYA_KINDS.campaign,
    objectId: row.id,
  });

  res.status(StatusCodes.OK).json(toDTO(row));
};

export const scheduleCampaign = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = campaignIdParamSchema.parse(req.params);
  const { scheduledFor } = scheduleBodySchema.parse(req.body);
  const existing = await requireCampaign(organizationId, id);

  const row = await prisma.campaign.update({
    where: { id: existing.id },
    data: { scheduledFor, status: CampaignStatus.SCHEDULED },
  });
  await projectCampaign(row.id);
  await recordMayaEvent({
    organizationId,
    userId,
    verb: "maya.campaign.scheduled",
    summary: `Scheduled "${row.name}" for ${scheduledFor.toDateString()}`,
    objectKind: MAYA_KINDS.campaign,
    objectId: row.id,
  });

  res.status(StatusCodes.OK).json(toDTO(row));
};

export const archiveCampaign = async (req: Request, res: Response) => {
  const { organizationId, userId } = requireAuth(req);
  const { id } = campaignIdParamSchema.parse(req.params);
  const existing = await requireCampaign(organizationId, id);

  const row = await prisma.campaign.update({
    where: { id: existing.id },
    data: { status: CampaignStatus.ARCHIVED },
  });
  await projectCampaign(row.id);
  await recordMayaEvent({
    organizationId,
    userId,
    verb: "maya.campaign.archived",
    summary: `Archived "${row.name}"`,
    objectKind: MAYA_KINDS.campaign,
    objectId: row.id,
  });

  res.status(StatusCodes.OK).json(toDTO(row));
};
