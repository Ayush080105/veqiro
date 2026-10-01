import { Router } from "express";
import { msgVega, msgVegaStream, getVegaMessages } from "./vega.controller.js";
import { generateBriefing, getBriefing } from "./vega.briefing.js";

const router = Router();

router.post("/chat", msgVega);
router.post("/chat/stream", msgVegaStream);
router.get("/chat", getVegaMessages);

router.post("/briefing", generateBriefing);
router.get("/briefing", getBriefing);

export default router;
