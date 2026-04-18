import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";
import scoutRouter from "./modules/agents/scout/scout.routes.js";

const router = Router();

router.use("/agents/sage", authMiddleware, sageRouter);
router.use("/agents/scout", authMiddleware, scoutRouter);

export default router;
