import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";
import { platformParamSchema, disconnectParamSchema } from "./integrations.schema.js";
import * as integrationsService from "./integrations.service.js";

const requireAuth = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

export const listIntegrations = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const accounts = await integrationsService.list(organizationId);
  res.status(StatusCodes.OK).json(accounts);
};

export const authorize = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuth(req);
  const { platform } = platformParamSchema.parse(req.params);
  const url = integrationsService.beginConnect({
    organizationId,
    userId,
    platform,
  });
  res.redirect(url);
};

export const callback = async (req: Request, res: Response) => {
  const { platform } = platformParamSchema.parse(req.params);
  const { redirectTo } = await integrationsService.handleCallback({
    platform,
    code: typeof req.query.code === "string" ? req.query.code : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    error: typeof req.query.error === "string" ? req.query.error : undefined,
    errorDescription:
      typeof req.query.error_description === "string"
        ? req.query.error_description
        : undefined,
  });
  res.redirect(redirectTo);
};

export const disconnect = async (req: Request, res: Response) => {
  const { organizationId } = requireAuth(req);
  const { id } = disconnectParamSchema.parse(req.params);
  await integrationsService.disconnect(organizationId, id);
  res.status(StatusCodes.NO_CONTENT).send();
};
