import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../lib/auth.js";

const router = Router();

// Better Auth handles all /auth/* subpaths
router.all("/*splat", toNodeHandler(auth));

export default router;
