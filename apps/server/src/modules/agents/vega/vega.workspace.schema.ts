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
