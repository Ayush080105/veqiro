import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import { entitlementMiddleware } from "./middlewares/entitlement.middleware.js";
import { internalKeyMiddleware } from "./middlewares/internal.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import rexRouter, { publicRouter as rexPublicRouter } from "./modules/agents/rex/rex.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";
import mayaRouter from "./modules/agents/maya/maya.routes.js";
import lexRouter from "./modules/agents/lex/lex.routes.js";
import vegaRouter from "./modules/agents/vega/vega.routes.js";
import contextRouter from "./modules/context/context.routes.js";
import integrationsProtectedRouter, {
  integrationsPublicRouter,
} from "./modules/integrations/integrations.routes.js";
import brandKitRouter from "./modules/brand-kit/brand-kit.routes.js";
import { getBrandKitInternal } from "./modules/brand-kit/brand-kit.controller.js";
import brandImagesRouter from "./modules/brand-images/brand-images.routes.js";
import { runWeeklyDigestNow, runDailyAlertsNow } from "./modules/agents/rex/rex.cron.js";
import messagesRouter from "./modules/messages/messages.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";
import uploadsRouter from "./modules/uploads/uploads.routes.js";
import billingRouter from "./modules/billing/billing.routes.js";

const router = Router();

// Public REX routes — webhook ingest (validated by API key in body) and public shared pins.
// Mounted BEFORE the protected router so authMiddleware doesn't intercept them.
router.use(rexPublicRouter);

router.use("/agents/sage",  authMiddleware, entitlementMiddleware, sageRouter);
router.use("/agents/rex",   authMiddleware, entitlementMiddleware, rexRouter);
router.use("/agents/scout", authMiddleware, entitlementMiddleware, scoutRouter);
router.use("/agents/maya",  authMiddleware, entitlementMiddleware, mayaRouter);
router.use("/agents/lex",   authMiddleware, entitlementMiddleware, lexRouter);
router.use("/agents/vega",  authMiddleware, entitlementMiddleware, vegaRouter);
router.use("/agents/context/:agent", authMiddleware, contextRouter);
router.use("/agents",       authMiddleware, entitlementMiddleware, messagesRouter);
router.use("/dashboard", authMiddleware, dashboardRouter);

router.use("/brand-kit", authMiddleware, brandKitRouter);
router.use("/brand-images", authMiddleware, brandImagesRouter);
router.get("/internal/brand-kit/:organizationId", internalKeyMiddleware, getBrandKitInternal);
router.post("/internal/cron/rex-weekly-digest", internalKeyMiddleware, (_req, res) => {
  void runWeeklyDigestNow().then(() => res.json({ ok: true }));
});
router.post("/internal/cron/rex-daily-alerts", internalKeyMiddleware, (_req, res) => {
  void runDailyAlertsNow().then(() => res.json({ ok: true }));
});

router.use("/uploads", authMiddleware, uploadsRouter);
router.use("/billing", authMiddleware, billingRouter);

// Public OAuth callbacks (state-verified) mounted BEFORE the protected router
router.use("/integrations", integrationsPublicRouter);
router.use("/integrations", integrationsProtectedRouter);

export default router;
