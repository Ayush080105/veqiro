import { Router } from "express";
import authMiddleware from "./middlewares/auth.middleware.js";
import sageRouter from "./modules/agents/sage/sage.routes.js";

const router = Router();

router.use("/agents/sage", authMiddleware, sageRouter);

export default router;
