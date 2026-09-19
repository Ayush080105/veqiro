import { Router } from "express";
import { HandoffStatus } from "../../../prisma/generated/prisma/client.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { entitlementForAgentParam } from "../../middlewares/entitlement.middleware.js";
import { internalKeyMiddleware } from "../../middlewares/internal.middleware.js";
import {
  getActivity,
  getApprovals,
  getHandoffs,
  getInsights,
  getMemory,
  getOverview,
  getWork,
  patchHandoffStatus,
  patchInsight,
  postHandoff,
  postReindex,
} from "./workspace.controller.js";

/**
 * /api/v1/workspace/*
 *
 * Two shapes live here. Agent-scoped reads sit under /:agent and are gated per
 * agent by entitlement, because a workspace is exactly as purchasable as the
 * employee it belongs to. Mutations of single records (an insight, a handoff)
 * are addressed by id at the top level: their owning agent is a property of the
 * row, and re-deriving it from the URL would only create a way for the two to
 * disagree.
 */
const router = Router();

const agentScoped = Router({ mergeParams: true });
agentScoped.get("/overview", getOverview);
agentScoped.get("/activity", getActivity);
agentScoped.get("/insights", getInsights);
agentScoped.get("/work", getWork);
agentScoped.get("/handoffs", getHandoffs);
agentScoped.get("/approvals", getApprovals);
agentScoped.get("/memory", getMemory);

router.use("/:agent", authMiddleware, entitlementForAgentParam(), agentScoped);

router.patch("/insights/:id", authMiddleware, patchInsight);

router.post("/handoffs", authMiddleware, postHandoff);
router.post("/handoffs/:id/accept", authMiddleware, patchHandoffStatus(HandoffStatus.ACCEPTED));
router.post("/handoffs/:id/decline", authMiddleware, patchHandoffStatus(HandoffStatus.DECLINED));

export default router;

/** Mounted separately under /internal — key-gated, never session-gated. */
export const workspaceInternalRouter = Router();
workspaceInternalRouter.post("/work-objects/reindex", internalKeyMiddleware, postReindex);
