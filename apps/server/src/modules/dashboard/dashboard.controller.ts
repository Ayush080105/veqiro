import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import * as service from "./dashboard.service.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";
import { UnauthenticatedError } from "../../common/errors/unauthenticated.js";

export const summary = async (req: Request, res: Response) => {
  if (!req.organizationId) {
    throw new UnauthenticatedError("Missing organization context");
  }

  // `agents` may arrive as a comma-separated string (e.g. ?agents=maya,rex) or
  // missing (absent => treat as "all agents" server-side). We distinguish
  // "absent" from "present but empty" (=> "no agents", server returns zeros).
  const raw = req.query as Record<string, string | undefined>;
  const agentsParam =
    raw.agents === undefined
      ? undefined
      : raw.agents === ""
        ? []
        : raw.agents.split(",").map((s) => s.trim()).filter(Boolean);

  const input = dashboardQuerySchema.parse({
    range: raw.range,
    from: raw.from,
    to: raw.to,
    agents: agentsParam,
  });

  const data = await service.getDashboardSummary(req.organizationId, input);
  res.status(StatusCodes.OK).json(data);
};

export const integrationHealth = async (req: Request, res: Response) => {
  if (!req.organizationId) {
    throw new UnauthenticatedError("Missing organization context");
  }
  const data = await service.getDashboardIntegrationHealth(req.organizationId);
  // Organization-scoped state should never be browser/proxy cached or served
  // as a body-less 304 to the credentialed frontend fetch.
  res.set("Cache-Control", "no-store");
  res.status(StatusCodes.OK).json(data);
};
