import { Router } from "express";
import * as c from "./hubspot.controller.js";

/** Mounted at /agents/rex/connections, behind auth and the Rex entitlement. */
const router = Router();
router.get("/", c.list);
router.post("/hubspot/token", c.connectToken);
router.post("/hubspot/oauth/start", c.oauthStart);
router.get("/:id/verify", c.verify);
router.get("/:id/objects/:type/fields", c.fields);
router.put("/:id/selection", c.saveSelection);
router.post("/:id/sync", c.syncNow);
router.delete("/:id", c.disconnect);

/** Mounted with no auth: the browser arrives from HubSpot; the signed `state` is the proof. */
export const publicRouter = Router();
publicRouter.get("/agents/rex/connections/hubspot/oauth/callback", c.oauthCallback);

export default router;
