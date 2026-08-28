import { Router } from "express";
import {
  getRun,
  listRuns,
  approveRun,
  rejectRun,
  cancelRun,
  submitStepAction,
} from "./agent-runs.controller.js";
import { internalKeyMiddleware } from "../../middlewares/internal.middleware.js";
import * as internalController from "./agent-runs.internal.controller.js";

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
agentRunsRouter.post("/:id/steps/:key/action", submitStepAction);

// Internal router — mounted separately in router.ts under /internal/runs,
// called only by apps/ai while it executes an approved plan. Node keeps every
// authorisation decision; this is the channel Python asks through.
export const runsInternalRouter = Router();
runsInternalRouter.use(internalKeyMiddleware);
runsInternalRouter.post("/:id/heartbeat", internalController.heartbeat);
runsInternalRouter.post("/:id/steps", internalController.addSteps);
runsInternalRouter.post("/:id/finish", internalController.finishRun);
runsInternalRouter.post("/:id/steps/:key/write", internalController.executeWrite);
runsInternalRouter.post("/:id/steps/:key", internalController.updateStep);
