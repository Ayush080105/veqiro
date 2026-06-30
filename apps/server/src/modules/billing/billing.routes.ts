import { Router } from "express";
import { createCheckout, getStatus, startTrial, openPortal } from "./billing.controller.js";

const router = Router();

router.get("/status", (req, res, next) => getStatus(req, res).catch(next));
router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/checkout",   (req, res, next) => createCheckout(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));

export default router;
