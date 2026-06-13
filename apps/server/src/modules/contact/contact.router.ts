import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import * as controller from "./contact.controller.js";

const router = Router();

// 5 submissions per IP per hour — generous for genuine use, blocks abuse.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/", contactLimiter, controller.send);

export default router;
