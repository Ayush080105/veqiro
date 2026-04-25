import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { presignUpload } from "./uploads.controller.js";

// Cap presign requests to keep a runaway client from generating thousands of
// signed URLs. The actual R2 PUT is rate-limited by the bucket and the URL's
// 5-minute expiry; this just guards the signing path.
const presignLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.organizationId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: "Too many upload requests — please wait a minute and try again.",
});

const router = Router();
router.post("/presign", presignLimiter, presignUpload);

export default router;
