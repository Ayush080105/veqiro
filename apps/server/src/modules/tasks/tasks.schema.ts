import { z } from "zod";

export const CreateTaskSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  cronExpression: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
});

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  cronExpression: z.string().optional().nullable(),
  timezone: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
