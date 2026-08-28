import { Router } from "express";
import {
  getRun,
  listRuns,
  approveRun,
  rejectRun,
  cancelRun,
} from "./agent-runs.controller.js";

/**
 * Planned-run surface. Mounted under /agents/runs behind auth + entitlement,
 * alongside the per-agent routers.
 */
export const agentRunsRouter: Router = Router();

agentRunsRouter.get("/", listRuns);
agentRunsRouter.get("/:id", getRun);
agentRunsRouter.post("/:id/approve", approveRun);
agentRunsRouter.post("/:id/reject", rejectRun);
agentRunsRouter.post("/:id/cancel", cancelRun);
