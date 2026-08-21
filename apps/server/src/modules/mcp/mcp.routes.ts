import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { internalKeyMiddleware } from "../../middlewares/internal.middleware.js";
import {
  listConnections,
  getConfigSchema,
  connect,
  getStatus,
  getProof,
  getCommandCenter,
  getValueReport,
  getActionLog,
  listApprovalPolicies,
  setApprovalPolicy,
  deleteApprovalPolicy,
  listPlays,
  setPlayEnabled,
  runPlayNow,
  disconnect,
  getPendingAction,
  confirmPendingAction,
  rejectPendingAction,
  getToolPreference,
  setToolPreference,
  listToolsInternal,
  callToolInternal,
} from "./mcp.controller.js";
import {
  listTriggers,
  subscribeTrigger,
  setTriggerEnabled,
  unsubscribeTrigger,
  handleComposioWebhook,
} from "./mcp.triggers.controller.js";

const router = Router();
router.use(authMiddleware);
router.get("/connections", listConnections);
router.get("/command-center", getCommandCenter);
router.get("/value-report", getValueReport);
router.get("/action-log", getActionLog);
router.get("/plays", listPlays);
router.patch("/plays/:id", setPlayEnabled);
router.post("/plays/:id/run", runPlayNow);
router.get("/approval-policies", listApprovalPolicies);
router.post("/approval-policies", setApprovalPolicy);
router.delete("/approval-policies/:id", deleteApprovalPolicy);
router.get("/connections/:slug/config-schema", getConfigSchema);
router.post("/connections/:slug/connect", connect);
router.get("/connections/:slug/status", getStatus);
router.get("/connections/:slug/proof", getProof);
router.delete("/connections/:slug", disconnect);
router.get("/pending-actions/:id", getPendingAction);
router.post("/pending-actions/:id/confirm", confirmPendingAction);
router.post("/pending-actions/:id/reject", rejectPendingAction);
router.get("/triggers", listTriggers);
router.post("/triggers/:id", subscribeTrigger);
router.patch("/triggers/:id", setTriggerEnabled);
router.delete("/triggers/:id", unsubscribeTrigger);
router.get("/tool-preference/:agent", getToolPreference);
router.patch("/tool-preference/:agent", setToolPreference);

export default router;

// Internal router — mounted separately in router.ts under /internal/mcp,
// called only by apps/ai (never by the browser). Node holds the Composio
// master key exclusively; this is apps/ai's sole path to it.
export const mcpInternalRouter = Router();
mcpInternalRouter.use(internalKeyMiddleware);
mcpInternalRouter.get("/connections/:connectionId/tools", listToolsInternal);
mcpInternalRouter.post("/connections/:connectionId/tools/call", callToolInternal);

// Public webhook router — Composio has no session to authenticate with, so
// this carries no auth middleware and the payload signature is the only thing
// that separates a real event from anyone who found the URL. Mounted in app.ts
// ahead of express.json()/camelizeBody, which would otherwise destroy both the
// exact bytes the signature covers and the snake_case keys the handler reads.
export const mcpWebhookRouter = Router();
mcpWebhookRouter.post("/composio", handleComposioWebhook);
