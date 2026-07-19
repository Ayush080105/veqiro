import { z } from "zod";

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export const connectBodySchema = z.object({
  configValues: z.record(z.string(), z.unknown()).optional(),
});

export const callToolBodySchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional().default({}),
});
