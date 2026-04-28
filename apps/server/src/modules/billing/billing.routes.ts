import { Router } from "express";
import { startTrial, openPortal } from "./billing.controller.js";

const router = Router();

router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));

export default router;
