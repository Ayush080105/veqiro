import { Router } from "express";
import { integrationHealth, summary } from "./dashboard.controller.js";

const router = Router();

router.get("/summary", summary);
router.get("/integration-health", integrationHealth);

export default router;
