import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  getBrandKit,
  saveBrandKit,
  finalizeBrandKit,
  finalizeAssetUpload,
  removeAsset,
} from "./brand-kit.controller.js";

const router = Router();

// Per-org rate limit on asset finalize. Each call HEADs an R2 object and
// (best-effort) deletes the previous one. Cap a single org at 10 / min.
const finalizeAssetLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.organizationId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: "Too many uploads — please wait a minute and try again.",
});

// The :organizationId URL param is advisory; the session's activeOrganizationId
// is authoritative (see auth.middleware.ts).
router.get("/:organizationId", getBrandKit);
router.get("/", getBrandKit);

// Auto-save (permissive — any subset of fields is fine).
router.patch("/", saveBrandKit);

// Marks Organization.onboarded = true; enforces the depth requirements.
router.post("/finalize", finalizeBrandKit);

// Logo / mascot to R2 — client uploads via presigned URL first, then calls
// this to verify (HeadObject) and persist the URL/key.
router.post("/upload-asset/finalize", finalizeAssetLimiter, finalizeAssetUpload);
router.delete("/asset/:kind", removeAsset);

export default router;
