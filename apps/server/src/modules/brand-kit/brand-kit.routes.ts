import { Router } from "express";
import {
  getBrandKit,
  saveBrandKit,
  finalizeBrandKit,
  uploadAsset,
  removeAsset,
} from "./brand-kit.controller.js";

const router = Router();

// The :organizationId URL param is advisory; the session's activeOrganizationId
// is authoritative (see auth.middleware.ts).
router.get("/:organizationId", getBrandKit);
router.get("/", getBrandKit);

// Auto-save (permissive — any subset of fields is fine).
router.patch("/", saveBrandKit);

// Marks Organization.onboarded = true; enforces the depth requirements.
router.post("/finalize", finalizeBrandKit);

// Logo / mascot to R2.
router.post("/upload-asset", uploadAsset);
router.delete("/asset/:kind", removeAsset);

export default router;
