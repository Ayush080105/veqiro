import { Router } from "express";
import {
  msgVega,
  getVegaMessages,
  processInbox,
  draftReply,
  calendarSummary,
  createEvent,
  executiveBriefing,
  composeEmail,
} from "./vega.controller.js";

const router = Router();

router.post("/chat", msgVega);
router.get("/chat", getVegaMessages);
router.post("/process-inbox", processInbox);
router.post("/draft-reply", draftReply);
router.post("/calendar-summary", calendarSummary);
router.post("/create-event", createEvent);
router.post("/executive-briefing", executiveBriefing);
router.post("/compose-email", composeEmail);

export default router;
