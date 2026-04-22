import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";
import mayaRouter from "./modules/agents/maya/maya.routes.js";
import lexRouter from "./modules/agents/lex/lex.routes.js";
import vegaRouter from "./modules/agents/vega/vega.routes.js";
import integrationsProtectedRouter, {
  integrationsPublicRouter,
} from "./modules/integrations/integrations.routes.js";
import brandKitRouter from "./modules/brand-kit/brand-kit.routes.js";

const router = Router();

router.use("/agents/sage", authMiddleware, sageRouter);
router.use("/agents/scout", authMiddleware, scoutRouter);
router.use("/agents/maya", authMiddleware, mayaRouter);
router.use("/agents/lex", authMiddleware, lexRouter);
router.use("/agents/vega", authMiddleware, vegaRouter);

router.use("/brand-kit", authMiddleware, brandKitRouter);

// Public OAuth callbacks (state-verified) mounted BEFORE the protected router
router.use("/integrations", integrationsPublicRouter);
router.use("/integrations", integrationsProtectedRouter);

export default router;
