import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(200).optional(),
});

export const processInboxSchema = z.object({
  maxEmails: z.number().int().min(1).max(100).optional().default(20),
  autoLabel: z.boolean().optional().default(true),
  draftReplies: z.boolean().optional().default(false),
});

export const draftReplySchema = z.object({
  emailId: z.string().min(1),
  replyInstructions: z.string().min(1).max(2000),
  tone: z.string().max(100).optional().default("professional"),
  saveAsDraft: z.boolean().optional().default(true),
});

export const calendarSummarySchema = z.object({
  daysAhead: z.number().int().min(1).max(30).optional().default(7),
});

export const createEventSchema = z.object({
  description: z.string().min(1).max(2000),
  checkConflicts: z.boolean().optional().default(true),
});

export const executiveBriefingSchema = z.object({
  includeEmail: z.boolean().optional().default(true),
  includeCalendar: z.boolean().optional().default(true),
});

export const composeEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  instructions: z.string().min(1).max(2000),
  tone: z.string().max(100).optional().default("professional"),
  includeCta: z.boolean().optional().default(true),
});
