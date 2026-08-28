import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import { entitlementMiddleware, entitlementMiddlewareForAgent } from "./middlewares/entitlement.middleware.js";
import { Agent } from "../prisma/generated/prisma/client.js";
import { internalKeyMiddleware } from "./middlewares/internal.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import rexRouter, { publicRouter as rexPublicRouter } from "./modules/agents/rex/rex.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";
import mayaRouter from "./modules/agents/maya/maya.routes.js";
import lexRouter from "./modules/agents/lex/lex.routes.js";
import vegaRouter from "./modules/agents/vega/vega.routes.js";
import {
  agentRunsRouter,
  runsInternalRouter,
} from "./modules/agent-runs/agent-runs.routes.js";
import { teamRouter } from "./modules/agent-runs/team.routes.js";
import contextRouter from "./modules/context/context.routes.js";
import integrationsProtectedRouter, {
  integrationsPublicRouter,
} from "./modules/integrations/integrations.routes.js";
import mcpRouter, { mcpInternalRouter } from "./modules/mcp/mcp.routes.js";
import brandKitRouter from "./modules/brand-kit/brand-kit.routes.js";
import { getBrandKitInternal } from "./modules/brand-kit/brand-kit.controller.js";
import brandImagesRouter from "./modules/brand-images/brand-images.routes.js";
import { runWeeklyDigestNow, runDailyAlertsNow } from "./modules/agents/rex/rex.cron.js";
import messagesRouter from "./modules/messages/messages.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";
import uploadsRouter from "./modules/uploads/uploads.routes.js";
import billingRouter, { publicRouter as billingPublicRouter } from "./modules/billing/billing.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import { adminMiddleware } from "./modules/admin/admin.middleware.js";
import feedbackRouter from "./modules/feedback/feedback.routes.js";
import expensesRouter from "./modules/expenses/expenses.routes.js";
import waitlistRouter from "./modules/waitlist/waitlist.router.js";
import contactRouter from "./modules/contact/contact.router.js";

const router = Router();

// Public waitlist routes — no auth required.
router.use("/waitlist", waitlistRouter);

// Public contact form — no auth required.
router.use("/contact", contactRouter);

// Public REX routes — webhook ingest (validated by API key in body) and public shared pins.
// Mounted BEFORE the protected router so authMiddleware doesn't intercept them.
router.use(rexPublicRouter);

// Public billing catalog — no session needed (apps/landing reads this too).
// Mounted BEFORE the protected /billing router so authMiddleware doesn't intercept it.
router.use(billingPublicRouter);

router.use("/agents/sage",  authMiddleware, entitlementMiddlewareForAgent(Agent.SAGE), sageRouter);
router.use("/agents/rex",   authMiddleware, entitlementMiddlewareForAgent(Agent.REX), rexRouter);
router.use("/agents/scout", authMiddleware, entitlementMiddlewareForAgent(Agent.SCOUT), scoutRouter);
router.use("/agents/maya",  authMiddleware, entitlementMiddlewareForAgent(Agent.MAYA), mayaRouter);
router.use("/agents/lex",   authMiddleware, entitlementMiddlewareForAgent(Agent.LEX), lexRouter);
router.use("/agents/vega",  authMiddleware, entitlementMiddlewareForAgent(Agent.VEGA), vegaRouter);
router.use("/agents/runs", authMiddleware, entitlementMiddleware, agentRunsRouter);
router.use("/agents/team", authMiddleware, teamRouter);
router.use("/agents/context/:agent", authMiddleware, contextRouter);
router.use("/agents",       authMiddleware, entitlementMiddleware, messagesRouter);
router.use("/dashboard", authMiddleware, dashboardRouter);

router.use("/brand-kit", authMiddleware, brandKitRouter);
router.use("/brand-images", authMiddleware, brandImagesRouter);
router.use("/internal/runs", runsInternalRouter);
router.get("/internal/brand-kit/:organizationId", internalKeyMiddleware, getBrandKitInternal);
router.post("/internal/cron/rex-weekly-digest", internalKeyMiddleware, (_req, res) => {
  void runWeeklyDigestNow().then(() => res.json({ ok: true }));
});
router.post("/internal/cron/rex-daily-alerts", internalKeyMiddleware, (_req, res) => {
  void runDailyAlertsNow().then(() => res.json({ ok: true }));
});

router.use("/uploads", authMiddleware, uploadsRouter);
router.use("/billing", authMiddleware, billingRouter);
router.use("/admin", adminMiddleware, adminRouter);
router.use("/feedback", authMiddleware, feedbackRouter);
router.use("/expenses", adminMiddleware, expensesRouter);

// Public OAuth callbacks (state-verified) mounted BEFORE the protected router
router.use("/integrations", integrationsPublicRouter);
router.use("/integrations", integrationsProtectedRouter);

router.use("/mcp", mcpRouter);
// apps/ai's only path to Composio — Node holds the master API key exclusively.
router.use("/internal/mcp", mcpInternalRouter);

export default router;
