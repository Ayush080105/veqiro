import { Router } from "express";
import { cancelAgent, createCheckout, getStatus, openPortal, resumeAgent, startTrial } from "./billing.controller.js";

const router = Router();

router.get("/status", (req, res, next) => getStatus(req, res).catch(next));
router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/checkout",   (req, res, next) => createCheckout(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));
router.post("/agents/:agent/cancel", (req, res, next) => cancelAgent(req, res).catch(next));
router.post("/agents/:agent/resume", (req, res, next) => resumeAgent(req, res).catch(next));

export default router;
