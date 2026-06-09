import { z } from "zod";

export const createFeedbackSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum([
    "FEATURE_REQUEST",
    "BUG_REPORT",
    "INTEGRATION",
    "NEW_AGENT",
    "UX_IMPROVEMENT",
    "GENERAL",
  ]),
  agentSlug: z
    .enum(["vega", "scout", "maya", "sage", "lex", "rex"])
    .nullable()
    .optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    "NEW",
    "UNDER_REVIEW",
    "PLANNED",
    "IN_PROGRESS",
    "LAUNCHED",
    "DECLINED",
  ]),
  roadmapEta: z.string().max(50).nullable().optional(),
  adminReply: z.string().max(2000).nullable().optional(),
  adminNote: z.string().max(1000).nullable().optional(),
});

export const mergePostSchema = z.object({
  targetId: z.string().min(1),
});

export const addCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const createUpcomingAgentSchema = z.object({
  name: z.string().min(1).max(100),
  tagline: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  order: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export const updateUpcomingAgentSchema = createUpcomingAgentSchema.partial();

export const listFeedbackSchema = z.object({
  status: z
    .enum([
      "NEW",
      "UNDER_REVIEW",
      "PLANNED",
      "IN_PROGRESS",
      "LAUNCHED",
      "DECLINED",
    ])
    .optional(),
  category: z
    .enum([
      "FEATURE_REQUEST",
      "BUG_REPORT",
      "INTEGRATION",
      "NEW_AGENT",
      "UX_IMPROVEMENT",
      "GENERAL",
    ])
    .optional(),
  agentSlug: z.string().optional(),
  sort: z.enum(["votes", "newest", "trending"]).default("votes"),
  search: z.string().max(200).optional(),
});
