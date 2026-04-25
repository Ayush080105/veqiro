import { z } from "zod"

export const VEGA_PRIORITIES = ["urgent", "high", "medium", "low"] as const

export const vegaProcessInboxSchema = z.object({
  max_emails: z.number().int().min(1).max(200).optional(),
  auto_label: z.boolean().optional(),
  draft_replies: z.boolean().optional(),
})
export type VegaProcessInboxValues = z.infer<typeof vegaProcessInboxSchema>

export const vegaDraftReplySchema = z.object({
  email_id: z.string().min(1, "Email id is required"),
  reply_instructions: z.string().min(2, "Tell Vega what to write"),
  tone: z.string().optional(),
  save_as_draft: z.boolean().optional(),
})
export type VegaDraftReplyValues = z.infer<typeof vegaDraftReplySchema>

export const vegaCalendarSummarySchema = z.object({
  days_ahead: z.number().int().min(1).max(30).optional(),
})
export type VegaCalendarSummaryValues = z.infer<typeof vegaCalendarSummarySchema>

export const vegaCreateEventSchema = z.object({
  description: z.string().min(2, "Describe the event"),
  check_conflicts: z.boolean().optional(),
})
export type VegaCreateEventValues = z.infer<typeof vegaCreateEventSchema>

export const vegaExecutiveBriefingSchema = z.object({
  include_email: z.boolean().optional(),
  include_calendar: z.boolean().optional(),
})
export type VegaExecutiveBriefingValues = z.infer<typeof vegaExecutiveBriefingSchema>

export const vegaComposeEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  instructions: z.string().min(2, "Tell Vega what to write"),
  tone: z.string().optional(),
  include_cta: z.boolean().optional(),
})
export type VegaComposeEmailValues = z.infer<typeof vegaComposeEmailSchema>
