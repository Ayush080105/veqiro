import { z } from "zod/v4";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default("USD"),
  memberNames: z.array(z.string().min(1)).default([]),
});

export const addMemberSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  category: z
    .enum([
      "FOOD",
      "TRAVEL",
      "ACCOMMODATION",
      "OFFICE",
      "ENTERTAINMENT",
      "UTILITIES",
      "SUBSCRIPTIONS",
      "EQUIPMENT",
      "OTHER",
    ])
    .default("OTHER"),
  paidByMemberId: z.string().min(1),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
  date: z.string().datetime(),
  isRecurring: z.boolean().default(false),
  cronExpression: z.string().optional(),
  splits: z.array(
    z.object({
      memberId: z.string().min(1),
      splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]),
      shareAmount: z.number().nonnegative(),
    }),
  ),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createSettlementSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  method: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  settledAt: z.string().datetime().optional(),
});

export const listExpensesQuerySchema = z.object({
  category: z
    .enum([
      "FOOD",
      "TRAVEL",
      "ACCOMMODATION",
      "OFFICE",
      "ENTERTAINMENT",
      "UTILITIES",
      "SUBSCRIPTIONS",
      "EQUIPMENT",
      "OTHER",
    ])
    .optional(),
  paidByMemberId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const askRexSchema = z.object({
  question: z.string().min(1).max(1000),
});
