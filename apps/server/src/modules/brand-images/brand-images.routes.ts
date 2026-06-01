import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  listBrandImages,
  finalizeBrandImageUpload,
  updateBrandImage,
  deleteBrandImage,
} from "./brand-images.controller.js";

const router = Router();

const finalizeLimiter = rateLimit({
  windowMs: 60_000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.organizationId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: "Too many uploads — please wait a minute and try again.",
});

router.get("/", listBrandImages);
router.post("/finalize", finalizeLimiter, finalizeBrandImageUpload);
router.patch("/:id", updateBrandImage);
router.delete("/:id", deleteBrandImage);

export default router;
