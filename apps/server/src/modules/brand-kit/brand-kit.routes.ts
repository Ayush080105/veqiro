import { Router } from "express";
import { getBrandKit, saveBrandKit } from "./brand-kit.controller.js";

const router = Router();

// The :organizationId URL param is advisory; the session's activeOrganizationId
// is authoritative (see auth.middleware.ts).
router.get("/:organizationId", getBrandKit);
router.get("/", getBrandKit);
router.patch("/", saveBrandKit);

export default router;
