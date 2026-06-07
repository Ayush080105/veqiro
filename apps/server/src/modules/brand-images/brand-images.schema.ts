import { z } from "zod";

export const finalizeBrandImageSchema = z.object({
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
});

export const updateBrandImageSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export type FinalizeBrandImageInput = z.infer<typeof finalizeBrandImageSchema>;
export type UpdateBrandImageInput = z.infer<typeof updateBrandImageSchema>;
