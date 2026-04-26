import { z } from "zod"

// Single source of truth — must mirror apps/server/src/modules/brand-kit/brand-kit.schema.ts.
// If you change a minimum here, change it server-side too. Server is authoritative.
export const BRAND_KIT_MINS = {
  companyName: 3,
  companyDescription: 120,
  valueProposition: 60,
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
  companyName: z
    .string()
    .min(
      BRAND_KIT_MINS.companyName,
      `Company name needs at least ${BRAND_KIT_MINS.companyName} characters`,
    )
    .max(200),
  companyDescription: z
    .string()
    .min(
      BRAND_KIT_MINS.companyDescription,
      `Add a bit more — agents need ~1–2 sentences (min ${BRAND_KIT_MINS.companyDescription} chars)`,
    )
    .max(2000),
  valueProposition: z
    .string()
    .min(
      BRAND_KIT_MINS.valueProposition,
      `One sentence: what problem you solve and what the customer gets (min ${BRAND_KIT_MINS.valueProposition} chars)`,
    )
    .max(500),
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
  // Logo is required for finalize. Mascot stays optional.
  logoUrl: z.string().min(1, "Upload a logo").max(1000),
  logoKey: z.string().min(1).max(500),
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
  // Wire-format mirror of server schema — server expects flat string[].
  competitors: z.array(z.string().min(1).max(500)).max(50).optional(),
  keyDifferentiators: z
    .string()
    .min(
      BRAND_KIT_MINS.keyDifferentiators,
      `Why you, not them — bullets work (min ${BRAND_KIT_MINS.keyDifferentiators} chars)`,
    )
    .max(2000),
  crawledContent: z.string().max(20000).nullable().optional(),
  crawledSummary: z.string().max(4000).nullable().optional(),
  crawlSource: z.string().max(50).nullable().optional(),
})

export type FinalizeBrainValues = z.infer<typeof finalizeBrainSchema>

// ── Brain page (auto-save) — permissive per-field, mirrors finalize shape ──
export const brainAutosaveSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyDescription: z.string(),
  valueProposition: z.string(),
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
  crawledContent: z.string().nullable(),
  crawledSummary: z.string().nullable(),
})

export type BrainAutosaveValues = z.infer<typeof brainAutosaveSchema>

// ── Onboarding flow — strict mins gated step-by-step via form.trigger ──
export const onboardingSchema = z.object({
  companyName: z
    .string()
    .min(
      BRAND_KIT_MINS.companyName,
      `Company name needs at least ${BRAND_KIT_MINS.companyName} characters`,
    ),
  companyDescription: z
    .string()
    .min(
      BRAND_KIT_MINS.companyDescription,
      `Add a bit more — agents need ~1–2 sentences (min ${BRAND_KIT_MINS.companyDescription} chars)`,
    )
    .max(2000),
  valueProposition: z
    .string()
    .min(
      BRAND_KIT_MINS.valueProposition,
      `One sentence: what problem you solve and what the customer gets (min ${BRAND_KIT_MINS.valueProposition} chars)`,
    )
    .max(500),
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
  // Logo is required at step 5. Kept nullable so the field's type matches
  // DEFAULT_VALUES (null on form mount) — the refine flags missing logos
  // when form.trigger runs at step5→step6.
  logoUrl: z
    .string()
    .nullable()
    .refine((v) => v != null && v.length > 0, "Upload a logo"),
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
  // Filled by the Auto-fill button or by the background crawl on finalize.
  // User can edit before finalizing.
  crawledSummary: z.string().max(4000).nullable().optional(),
  crawledContent: z.string().max(20000).nullable().optional(),
})

export type OnboardingValues = z.infer<typeof onboardingSchema>
