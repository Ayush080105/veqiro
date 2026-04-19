import { z } from "zod";

export const platformParamSchema = z.object({
  platform: z.enum(["twitter", "linkedin", "instagram"]),
});

export const disconnectParamSchema = z.object({
  id: z.string().min(1),
});
