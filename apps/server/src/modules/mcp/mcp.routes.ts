import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { internalKeyMiddleware } from "../../middlewares/internal.middleware.js";
import {
  listConnections,
  getConfigSchema,
  connect,
  getStatus,
  disconnect,
  listToolsInternal,
  callToolInternal,
} from "./mcp.controller.js";

const router = Router();
router.use(authMiddleware);
router.get("/connections", listConnections);
router.get("/connections/:slug/config-schema", getConfigSchema);
router.post("/connections/:slug/connect", connect);
router.get("/connections/:slug/status", getStatus);
router.delete("/connections/:slug", disconnect);

export default router;

// Internal router — mounted separately in router.ts under /internal/mcp,
// called only by apps/ai (never by the browser). Node holds the Composio
// master key exclusively; this is apps/ai's sole path to it.
export const mcpInternalRouter = Router();
mcpInternalRouter.use(internalKeyMiddleware);
mcpInternalRouter.get("/connections/:connectionId/tools", listToolsInternal);
mcpInternalRouter.post("/connections/:connectionId/tools/call", callToolInternal);
