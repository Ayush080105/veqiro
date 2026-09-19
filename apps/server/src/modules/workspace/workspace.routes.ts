import { Router } from "express";
import { HandoffStatus } from "../../../prisma/generated/prisma/client.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import {
  entitlementForAgentParam,
  entitlementMiddleware,
} from "../../middlewares/entitlement.middleware.js";
import { internalKeyMiddleware } from "../../middlewares/internal.middleware.js";
import {
  getActivity,
  getApprovals,
  getHandoffs,
  getInsights,
  getMemory,
  getOutcomes,
  getOverview,
  getPulse,
  getWork,
  patchHandoffStatus,
  patchInsight,
  patchMemoryItem,
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

// ─── Order matters ───────────────────────────────────────────────────────────
// Everything with a literal first segment MUST be registered before the
// "/:agent" mount below. Express matches in order, so "/:agent" happily
// captures "pulse", "insights" or "handoffs" as an agent slug, and
// entitlementForAgentParam then rejects the request as an unknown agent — a
// 404 on a perfectly valid endpoint, with nothing in the logs to suggest
// routing was the cause.

/** Org-wide: seeing that Lex has three open findings is not opening Lex, so
 *  this takes the generic entitlement rather than a per-agent one. */
router.get("/pulse", authMiddleware, entitlementMiddleware, getPulse);
router.get("/outcomes", authMiddleware, entitlementMiddleware, getOutcomes);

// Single records are addressed by id: their owning agent is a property of the
// row, and re-deriving it from the URL would only create a way for the two to
// disagree.
router.patch("/insights/:id", authMiddleware, patchInsight);
router.patch("/memory-items/:id", authMiddleware, patchMemoryItem);

router.post("/handoffs", authMiddleware, postHandoff);
router.post("/handoffs/:id/accept", authMiddleware, patchHandoffStatus(HandoffStatus.ACCEPTED));
router.post("/handoffs/:id/decline", authMiddleware, patchHandoffStatus(HandoffStatus.DECLINED));

// ─── Agent-scoped ────────────────────────────────────────────────────────────
const agentScoped = Router({ mergeParams: true });
agentScoped.get("/overview", getOverview);
agentScoped.get("/activity", getActivity);
agentScoped.get("/insights", getInsights);
agentScoped.get("/work", getWork);
agentScoped.get("/handoffs", getHandoffs);
agentScoped.get("/approvals", getApprovals);
agentScoped.get("/memory", getMemory);

router.use("/:agent", authMiddleware, entitlementForAgentParam(), agentScoped);

export default router;

/** Mounted separately under /internal — key-gated, never session-gated. */
export const workspaceInternalRouter = Router();
workspaceInternalRouter.post("/work-objects/reindex", internalKeyMiddleware, postReindex);
