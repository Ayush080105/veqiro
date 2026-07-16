import { Router } from "express";
import {
  cancelAgent,
  cancelCrew,
  createCheckout,
  dismissPendingCheckout,
  getStatus,
  getUpgradeQuote,
  openPortal,
  resumeAgent,
  resumeCrew,
  startMayaTopupCheckout,
  startTrial,
} from "./billing.controller.js";
import { getBillingCatalog } from "./billing.catalog.controller.js";

// Public, unauthenticated — mounted at root (before authMiddleware wraps the
// rest of this module in router.ts), matching the rexPublicRouter pattern.
// apps/landing has no session and still needs real prices.
export const publicRouter = Router();
publicRouter.get("/billing/catalog", (req, res, next) => {
  try {
    getBillingCatalog(req, res);
  } catch (err) {
    next(err);
  }
});

const router = Router();

router.get("/status", (req, res, next) => getStatus(req, res).catch(next));
router.get("/upgrade-quote", (req, res, next) => getUpgradeQuote(req, res).catch(next));
router.post("/start-trial", (req, res, next) => startTrial(req, res).catch(next));
router.post("/checkout",   (req, res, next) => createCheckout(req, res).catch(next));
router.post("/portal",      (req, res, next) => openPortal(req, res).catch(next));
router.post("/agents/:agent/cancel", (req, res, next) => cancelAgent(req, res).catch(next));
router.post("/agents/:agent/resume", (req, res, next) => resumeAgent(req, res).catch(next));
router.post("/crew/cancel", (req, res, next) => cancelCrew(req, res).catch(next));
router.post("/crew/resume", (req, res, next) => resumeCrew(req, res).catch(next));
router.post("/maya/topup/checkout", (req, res, next) => startMayaTopupCheckout(req, res).catch(next));
router.delete("/pending-checkout", (req, res, next) => dismissPendingCheckout(req, res).catch(next));

export default router;
