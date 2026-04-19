import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";
import mayaRouter from "./modules/agents/maya/maya.routes.js";
import lexRouter from "./modules/agents/lex/lex.routes.js";
import integrationsProtectedRouter, {
  integrationsPublicRouter,
} from "./modules/integrations/integrations.routes.js";

const router = Router();

router.use("/agents/sage", authMiddleware, sageRouter);
router.use("/agents/scout", authMiddleware, scoutRouter);
router.use("/agents/maya", authMiddleware, mayaRouter);
router.use("/agents/lex", authMiddleware, lexRouter);

// Public OAuth callbacks (state-verified) mounted BEFORE the protected router
router.use("/integrations", integrationsPublicRouter);
router.use("/integrations", integrationsProtectedRouter);

export default router;
