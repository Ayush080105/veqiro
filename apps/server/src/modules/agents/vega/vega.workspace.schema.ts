import { z } from "zod";

export const getInboxSchema = z.object({
  maxEmails: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const sendReplySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  threadId: z.string().optional().nullable(),
});

export const createFollowUpSchema = z.object({
  emailId: z.string().min(1),
  emailSubject: z.string().min(1).max(500),
  senderEmail: z.string().email(),
  dueAt: z.string().datetime(),
  draftText: z.string().min(1).max(5000),
});

export const addVIPContactSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
});

export const generateBriefingSchema = z.object({
  includeEmail: z.boolean().optional().default(true),
  includeCalendar: z.boolean().optional().default(true),
  type: z.enum(["MORNING", "EVENING", "WEEKLY"]).optional().default("MORNING"),
});

export const getCalendarSchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(30).optional().default(7),
});

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  start: z.string().datetime(),
  end: z.string().datetime(),
  attendees: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
  addGoogleMeet: z.boolean().optional().default(true),
});

export const getMeetingPrepSchema = z.object({
  eventTitle: z.string().min(1).max(500),
  attendeeEmails: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
});

export const postMeetingFollowUpSchema = z.object({
  eventTitle: z.string().min(1).max(500),
  attendeeEmails: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export const sendFollowUpEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
});

export const updateCalendarEventSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  })
  .refine((data) => new Date(data.start) < new Date(data.end), {
    message: "end must be after start",
    path: ["end"],
  });

export const rescheduleDraftSchema = z
  .object({
    eventTitle: z.string().min(1).max(500),
    attendeeEmails: z.array(z.string().email()).optional().default([]),
    originalStart: z.string().datetime(),
    newStart: z.string().datetime(),
    newEnd: z.string().datetime(),
  })
  .refine((data) => new Date(data.newStart) < new Date(data.newEnd), {
    message: "newEnd must be after newStart",
    path: ["newEnd"],
  });

export const bulkInboxActionSchema = z.object({
  emailIds: z.array(z.string()).min(1).max(50),
  action: z.enum(["ignore", "snooze"]),
  snoozeUntil: z.string().datetime().optional(),
});

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#999999"),
});

export const updateLabelSchema = z.object({
  autoReply: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
