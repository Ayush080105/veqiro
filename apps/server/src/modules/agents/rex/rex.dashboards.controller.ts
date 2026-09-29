import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import * as dashboards from "./rex.dashboards.service.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) throw new UnauthenticatedError("Missing user context");
  return { userId: req.userId, organizationId: req.organizationId };
};

const param = (req: Request, name: string): string => {
  const v = req.params[name];
  if (typeof v !== "string" || !v) throw new BadRequestError(`${name} is required`);
  return v;
};

/** `?f={"filterId":"value"}` → a filter state. Values are checked against the dashboard's own
 *  options later; here it only has to be a flat object of strings. */
const filterStateSchema = z.record(z.string(), z.string()).default({});
const readState = (req: Request): dashboards.FilterState => {
  const raw = req.query["f"];
  if (typeof raw !== "string" || !raw) return {};
  try {
    return filterStateSchema.parse(JSON.parse(raw));
  } catch {
    throw new BadRequestError("Invalid filter state");
  }
};

const createSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  datasetIds: z.array(z.string().min(1)).min(1).max(dashboards.MAX_DATASETS),
});
const promptSchema = z.object({ prompt: z.string().trim().min(2).max(2000), widgetId: z.string().optional() });
const patchSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), description: z.string().max(300).nullable().optional() });
const layoutSchema = z.object({
  items: z.array(z.object({
    id: z.string(), x: z.number().int().min(0).max(11), y: z.number().int().min(0).max(500),
    w: z.number().int().min(1).max(12), h: z.number().int().min(1).max(20),
  })).max(50),
});
const widgetPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  spec: z.record(z.string(), z.unknown()).optional(),
  sql: z.string().min(1).max(8000).optional(),
  filterIds: z.array(z.string()).max(10).optional(),
});
const shareSchema = z.object({ isPublic: z.boolean() });
const linkSchema = z.object({ url: z.string().trim().min(8).max(2000) });
const syncSchema = z.object({ sourceUrl: z.string().min(8).max(2000) });

export const list = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await dashboards.listDashboards(organizationId));
};

export const create = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = createSchema.parse(req.body);
  res.status(StatusCodes.CREATED).json(await dashboards.createDashboard(userId, organizationId, input));
};

export const get = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await dashboards.getDashboard(organizationId, param(req, "id"), readState(req)));
};

export const edit = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = promptSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await dashboards.editByPrompt(userId, organizationId, param(req, "id"), input));
};

export const patch = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await dashboards.updateDashboard(organizationId, param(req, "id"), patchSchema.parse(req.body)));
};

export const remove = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  await dashboards.deleteDashboard(organizationId, param(req, "id"));
  res.status(StatusCodes.NO_CONTENT).end();
};

export const layout = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  await dashboards.updateLayout(organizationId, param(req, "id"), layoutSchema.parse(req.body).items);
  res.status(StatusCodes.NO_CONTENT).end();
};

export const patchWidget = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = widgetPatchSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await dashboards.updateWidget(organizationId, param(req, "id"), param(req, "wid"), input));
};

export const removeWidget = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await dashboards.deleteWidget(organizationId, param(req, "id"), param(req, "wid")));
};

export const duplicateWidget = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  res.status(StatusCodes.OK).json(await dashboards.duplicateWidget(organizationId, param(req, "id"), param(req, "wid")));
};

export const refresh = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const id = param(req, "id");
  const result = await dashboards.refreshDashboard(organizationId, id, { force: true });
  res.status(StatusCodes.OK).json({ ...result, dashboard: await dashboards.getDashboard(organizationId, id) });
};

export const share = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { isPublic } = shareSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await dashboards.shareDashboard(organizationId, param(req, "id"), isPublic));
};

export const parseLink = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { url } = linkSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await dashboards.parseLink(organizationId, url));
};

export const syncLink = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { sourceUrl } = syncSchema.parse(req.body);
  res.status(StatusCodes.OK).json(await dashboards.syncLinkedSource(organizationId, sourceUrl));
};

export const getPublic = async (req: Request, res: Response) => {
  const result = await dashboards.getPublicDashboard(param(req, "token"), readState(req));
  if (!result) {
    res.status(StatusCodes.NOT_FOUND).json({ error: "Dashboard not found or no longer public" });
    return;
  }
  res.set("Cache-Control", "public, max-age=30");
  res.status(StatusCodes.OK).json(result);
};
