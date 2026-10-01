import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { NotFoundError } from "../../../common/errors/notFound.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import { SeoIssueStatus } from "../../../../prisma/generated/prisma/client.js";
import { getSeoPage, listSeoPages, setIssueStatus } from "./sage.pages.js";

const requireAuth = (req: Request): { organizationId: string } => {
  if (!req.organizationId) throw new UnauthenticatedError("Missing user context");
  return { organizationId: req.organizationId };
};

const idParamSchema = z.object({ id: z.string().min(1) });
const issueBodySchema = z.object({ status: z.nativeEnum(SeoIssueStatus) });

export const listPages = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  res.status(StatusCodes.OK).json(await listSeoPages(organizationId));
};

export const getPage = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const page = await getSeoPage(organizationId, id);
  if (!page) throw new NotFoundError("Page not found");
  res.status(StatusCodes.OK).json(page);
};

export const patchIssue = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const { status } = issueBodySchema.parse(req.body);
  const updated = await setIssueStatus(organizationId, id, status);
  if (!updated) throw new NotFoundError("Issue not found");
  res.status(StatusCodes.OK).json(updated);
};
