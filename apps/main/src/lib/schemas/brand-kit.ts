import { z } from "zod"

// Single source of truth — must mirror apps/server/src/modules/brand-kit/brand-kit.schema.ts.
// If you change a minimum here, change it server-side too. Server is authoritative.
export const BRAND_KIT_MINS = {
  companyDescription: 120,
  targetAudience: 100,
  keyDifferentiators: 80,
} as const

export const ALLOWED_ASSET_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const
export const MAX_ASSET_BYTES = 5 * 1024 * 1024

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/u, "Use a 6-digit hex like #1A2B3C")

const optionalUrl = z
  .string()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//u.test(v), "Use a valid http(s) URL")

// ── Strict schema for finalize / "meet the crew" ────────────────────────
// Used in the onboarding flow's final submit. Auto-save flows use a permissive
// per-field check (just the typing of the field, no required minimums).
export const finalizeBrainSchema = z.object({
  companyName: z.string().min(2, "Company name is required").max(200),
  companyDescription: z
    .string()
    .min(
      BRAND_KIT_MINS.companyDescription,
      `Add a bit more — agents need ~1–2 sentences (min ${BRAND_KIT_MINS.companyDescription} chars)`,
    )
    .max(2000),
  industry: z.string().min(2, "Pick an industry").max(200),
  targetAudience: z
    .string()
    .min(
      BRAND_KIT_MINS.targetAudience,
      `Be specific — job titles, company size, motivations (min ${BRAND_KIT_MINS.targetAudience} chars)`,
    )
    .max(1000),
  brandVoice: z.string().min(1, "Pick a voice").max(200),
  websiteUrl: optionalUrl.optional().or(z.literal("")),
  logoUrl: z.string().max(1000).nullable().optional(),
  logoKey: z.string().max(500).nullable().optional(),
  mascotUrl: z.string().max(1000).nullable().optional(),
  mascotKey: z.string().max(500).nullable().optional(),
  brandColors: z
    .object({
      primary: hexColor.or(z.literal("")),
      secondary: hexColor.or(z.literal("")),
      accent: hexColor.or(z.literal("")),
    })
    .partial()
    .optional(),
  platformTones: z
    .object({
      twitter: z.string().max(200),
      linkedin: z.string().max(200),
      instagram: z.string().max(200),
    })
    .partial()
    .optional(),
  competitors: z
    .array(z.object({ value: z.string().min(1).max(500) }))
    .max(50)
    .optional(),
  keyDifferentiators: z
    .string()
    .min(
      BRAND_KIT_MINS.keyDifferentiators,
      `Why you, not them — bullets work (min ${BRAND_KIT_MINS.keyDifferentiators} chars)`,
    )
    .max(2000),
})

export type FinalizeBrainValues = z.infer<typeof finalizeBrainSchema>

// ── Brain page (auto-save) — permissive per-field, mirrors finalize shape ──
export const brainAutosaveSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyDescription: z.string(),
  websiteUrl: z.string(),
  industry: z.string(),
  targetAudience: z.string(),
  brandVoice: z.string(),
  platformTones: z.object({
    twitter: z.string(),
    linkedin: z.string(),
    instagram: z.string(),
  }),
  brandColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  competitors: z.array(z.object({ value: z.string() })),
  keyDifferentiators: z.string(),
  logoUrl: z.string().nullable(),
  logoKey: z.string().nullable(),
  mascotUrl: z.string().nullable(),
  mascotKey: z.string().nullable(),
})

export type BrainAutosaveValues = z.infer<typeof brainAutosaveSchema>

// ── Onboarding flow — strict mins gated step-by-step via form.trigger ──
export const onboardingSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyDescription: z
    .string()
    .min(
      BRAND_KIT_MINS.companyDescription,
      `Add a bit more — agents need ~1–2 sentences (min ${BRAND_KIT_MINS.companyDescription} chars)`,
    )
    .max(2000),
  industry: z.string().min(1, "Pick an industry"),
  targetAudience: z
    .string()
    .min(
      BRAND_KIT_MINS.targetAudience,
      `Be specific — job titles, motivations (min ${BRAND_KIT_MINS.targetAudience} chars)`,
    )
    .max(1000),
  brandVoice: z.string().min(1, "Pick a voice"),
  websiteUrl: z
    .string()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//u.test(v), "Use a valid http(s) URL"),
  logoUrl: z.string().nullable(),
  logoKey: z.string().nullable(),
  mascotUrl: z.string().nullable(),
  mascotKey: z.string().nullable(),
  brandColors: z.tuple([z.string(), z.string(), z.string()]),
  competitors: z.string(), // comma-separated, parsed at submit
  keyDifferentiators: z
    .string()
    .min(
      BRAND_KIT_MINS.keyDifferentiators,
      `Why you, not them — bullets work (min ${BRAND_KIT_MINS.keyDifferentiators} chars)`,
    )
    .max(2000),
})

export type OnboardingValues = z.infer<typeof onboardingSchema>
