import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { BadRequestError } from "../../common/errors/badRequest.js";
import {
  slugParamSchema,
  connectBodySchema,
  callToolBodySchema,
  pendingActionParamSchema,
  agentParamSchema,
  toolPreferenceBodySchema,
  runWidgetBodySchema,
  addTileBodySchema,
  tileIdParamSchema,
} from "./mcp.schema.js";
import * as mcpService from "./mcp.service.js";

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const listConnections = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const connections = await mcpService.listConnections(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(connections);
};

export const getConfigSchema = async (req: Request, res: Response) => {
  requireAuth(req);
  const { slug } = slugParamSchema.parse(req.params);
  const schema = await mcpService.getConfigSchema(slug);
  res.status(StatusCodes.OK).json(schema);
};

export const connect = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuth(req);
  const { slug } = slugParamSchema.parse(req.params);
  const { configValues } = connectBodySchema.parse(req.body ?? {});
  const result = await mcpService.connect({ organizationId, userId, slug, configValues });
  res.status(StatusCodes.OK).json(result);
};

export const getCommandCenter = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  // ?refresh=1 skips the server cache — the customer pressed refresh because
  // they know something changed, so honour it rather than serving a cached read.
  const forceRefresh = req.query.refresh === "1";
  const summary = await mcpService.getCommandCenter(organizationId, { forceRefresh });
  // Server-cached with its own TTL; no-store keeps the browser from stacking a
  // second, staler cache on top of it.
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(summary);
};

export const getValueReport = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const report = await mcpService.getValueReport(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(report);
};

export const listAvailableWidgets = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const widgets = await mcpService.listAvailableWidgets(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(widgets);
};

// POST because a widget run carries structured inputs and is never cacheable.
export const runWidget = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { widgetId, inputs } = runWidgetBodySchema.parse(req.body ?? {});
  const result = await mcpService.runWidget(organizationId, widgetId, inputs ?? {});
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(result);
};

export const listTiles = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const tiles = await mcpService.listTiles(organizationId);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(tiles);
};

export const addTile = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const body = addTileBodySchema.parse(req.body ?? {});
  await mcpService.addTile(organizationId, body);
  res.status(StatusCodes.CREATED).json(await mcpService.listTiles(organizationId));
};

export const removeTile = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = tileIdParamSchema.parse(req.params);
  await mcpService.removeTile(organizationId, id);
  res.status(StatusCodes.OK).json(await mcpService.listTiles(organizationId));
};

export const getProof = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { slug } = slugParamSchema.parse(req.params);
  const proof = await mcpService.getConnectionProof(organizationId, slug);
  // Always fresh: this is read once, on the connect success screen, and a
  // cached count from a previous connection would defeat the entire point.
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(proof);
};

export const getStatus = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { slug } = slugParamSchema.parse(req.params);
  const summary = await mcpService.refreshStatus(organizationId, slug);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(summary);
};

export const disconnect = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { slug } = slugParamSchema.parse(req.params);
  await mcpService.disconnect(organizationId, slug);
  res.status(StatusCodes.NO_CONTENT).send();
};

export const getPendingAction = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = pendingActionParamSchema.parse(req.params);
  const result = await mcpService.getPendingAction(organizationId, id);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(result);
};

export const confirmPendingAction = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = pendingActionParamSchema.parse(req.params);
  const result = await mcpService.confirmPendingAction(organizationId, id);
  res.status(StatusCodes.OK).json(result);
};

export const rejectPendingAction = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = pendingActionParamSchema.parse(req.params);
  const result = await mcpService.rejectPendingAction(organizationId, id);
  res.status(StatusCodes.OK).json(result);
};

export const getToolPreference = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { agent } = agentParamSchema.parse(req.params);
  const result = await mcpService.getToolPreference(organizationId, agent);
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(result);
};

export const setToolPreference = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { agent } = agentParamSchema.parse(req.params);
  const { preferredIntegrationSlug } = toolPreferenceBodySchema.parse(req.body ?? {});
  const result = await mcpService.setToolPreference(organizationId, agent, preferredIntegrationSlug);
  res.status(StatusCodes.OK).json(result);
};

// --- Internal (apps/ai only, internalKeyMiddleware-protected) ---

const requireInternalOrgAndConnection = (req: Request): { organizationId: string; connectionId: string } => {
  const organizationId = typeof req.query.organization_id === "string" ? req.query.organization_id : undefined;
  const connectionId = typeof req.params.connectionId === "string" ? req.params.connectionId : undefined;
  if (!organizationId || !connectionId) {
    throw new BadRequestError("organization_id and connectionId are required");
  }
  return { organizationId, connectionId };
};

export const listToolsInternal = async (req: Request, res: Response) => {
  const { organizationId, connectionId } = requireInternalOrgAndConnection(req);
  const tools = await mcpService.listToolsForConnection(organizationId, connectionId);
  res.status(StatusCodes.OK).json({ tools });
};

export const callToolInternal = async (req: Request, res: Response) => {
  const { organizationId, connectionId } = requireInternalOrgAndConnection(req);
  const { toolName, args } = callToolBodySchema.parse(req.body ?? {});
  const result = await mcpService.callTool(organizationId, connectionId, toolName, args);
  res.status(StatusCodes.OK).json(result);
};
