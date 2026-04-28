import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import { internalKeyMiddleware } from "./middlewares/internal.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import rexRouter from "./modules/agents/rex/rex.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";
import mayaRouter from "./modules/agents/maya/maya.routes.js";
import lexRouter from "./modules/agents/lex/lex.routes.js";
import vegaRouter from "./modules/agents/vega/vega.routes.js";
import integrationsProtectedRouter, {
  integrationsPublicRouter,
} from "./modules/integrations/integrations.routes.js";
import brandKitRouter from "./modules/brand-kit/brand-kit.routes.js";
import { getBrandKitInternal } from "./modules/brand-kit/brand-kit.controller.js";
import { runWeeklyDigestNow } from "./modules/agents/rex/rex.cron.js";
import messagesRouter from "./modules/messages/messages.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";
import uploadsRouter from "./modules/uploads/uploads.routes.js";
import billingRouter from "./modules/billing/billing.routes.js";

const router = Router();

router.use("/agents/sage", authMiddleware, sageRouter);
router.use("/agents/rex", authMiddleware, rexRouter);
router.use("/agents/scout", authMiddleware, scoutRouter);
router.use("/agents/maya", authMiddleware, mayaRouter);
router.use("/agents/lex", authMiddleware, lexRouter);
router.use("/agents/vega", authMiddleware, vegaRouter);
router.use("/agents", authMiddleware, messagesRouter);
router.use("/dashboard", authMiddleware, dashboardRouter);

router.use("/brand-kit", authMiddleware, brandKitRouter);
router.get("/internal/brand-kit/:organizationId", internalKeyMiddleware, getBrandKitInternal);
router.post("/internal/cron/rex-weekly-digest", internalKeyMiddleware, (_req, res) => {
  void runWeeklyDigestNow().then(() => res.json({ ok: true }));
});

router.use("/uploads", authMiddleware, uploadsRouter);
router.use("/billing", authMiddleware, billingRouter);

// Public OAuth callbacks (state-verified) mounted BEFORE the protected router
router.use("/integrations", integrationsPublicRouter);
router.use("/integrations", integrationsProtectedRouter);

export default router;
