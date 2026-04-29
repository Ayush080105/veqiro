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
import {
  getInbox,
  sendReply,
  getFollowUps,
  createFollowUp,
  cancelFollowUp,
  getVIPContacts,
  addVIPContact,
  removeVIPContact,
  getBriefing,
  generateBriefing,
  getCalendarEvents,
  createCalendarEventHandler,
  getMeetingPrepHandler,
  postMeetingFollowUpHandler,
  sendFollowUpEmailHandler,
  updateCalendarEventHandler,
  getRescheduleDraftHandler,
  bulkInboxActionHandler,
} from "./vega.workspace.controller.js";

const router = Router();

router.post("/chat", msgVega);
router.get("/chat", getVegaMessages);
router.post("/process-inbox", processInbox);
router.post("/draft-reply", draftReply);
router.post("/calendar-summary", calendarSummary);
router.post("/create-event", createEvent);
router.post("/executive-briefing", executiveBriefing);
router.post("/compose-email", composeEmail);

// workspace: inbox
router.get("/inbox", getInbox);
router.post("/inbox/bulk", bulkInboxActionHandler);
router.post("/inbox/:emailId/reply", sendReply);

// workspace: follow-ups
router.get("/follow-ups", getFollowUps);
router.post("/follow-ups", createFollowUp);
router.delete("/follow-ups/:followUpId", cancelFollowUp);

// workspace: VIP contacts
router.get("/vip-contacts", getVIPContacts);
router.post("/vip-contacts", addVIPContact);
router.delete("/vip-contacts/:contactId", removeVIPContact);

// workspace: briefing cache
router.get("/briefing", getBriefing);
router.post("/briefing/generate", generateBriefing);

// workspace: calendar
router.get("/calendar/events", getCalendarEvents);
router.post("/calendar/events", createCalendarEventHandler);
router.post("/calendar/prep", getMeetingPrepHandler);

// workspace: post-meeting follow-up
router.post("/calendar/followup", postMeetingFollowUpHandler);
router.post("/calendar/followup/send", sendFollowUpEmailHandler);

// workspace: reschedule
router.patch("/calendar/events/:eventId", updateCalendarEventHandler);
router.post("/calendar/reschedule-draft", getRescheduleDraftHandler);

export default router;
