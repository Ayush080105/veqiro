import { z } from "zod";

export const sendMessageSchema = z.object({
  organizationId: z.string().min(1).max(16),
  content: z.string().min(1).max(1000),
});
