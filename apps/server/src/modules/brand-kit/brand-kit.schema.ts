import { z } from "zod";

const brandColorsSchema = z
  .object({
    primary: z.string().default(""),
    secondary: z.string().default(""),
    accent: z.string().default(""),
  })
  .partial();

const platformTonesSchema = z
  .object({
    twitter: z.string().default(""),
    linkedin: z.string().default(""),
    instagram: z.string().default(""),
  })
  .partial();

export const saveBrandKitSchema = z.object({
  organizationId: z.string().optional(),
  company_name: z.string().max(200).optional(),
  company_description: z.string().max(2000).optional(),
  industry: z.string().max(200).optional(),
  target_audience: z.string().max(1000).optional(),
  brand_voice: z.string().max(200).optional(),
  logo_url: z.string().max(1000).nullable().optional(),
  mascot_url: z.string().max(1000).nullable().optional(),
  brand_colors: brandColorsSchema.optional(),
  platform_tones: platformTonesSchema.optional(),
  competitors: z.array(z.string().max(500)).max(50).optional(),
  key_differentiators: z.string().max(2000).optional(),
  website_url: z.string().max(500).optional(),
});

export type SaveBrandKitInput = z.infer<typeof saveBrandKitSchema>;
