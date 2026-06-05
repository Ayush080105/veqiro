import { z } from "zod";

// Tuned minimums: not arbitrary char counts. These match the depth needed for
// LLM agents to ground in *what* + *for whom* + *why-you-not-them*. A 30-char
// company description gives Maya nothing to work with — ~120 chars forces 1–2
// substantive sentences.
export const BRAND_KIT_MINS = {
  companyName: 3,
  companyDescription: 120,
  valueProposition: 60,
  targetAudience: 100,
  keyDifferentiators: 80,
} as const;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/u, "Must be a 6-digit hex colour like #1A2B3C");

const brandColorsSchema = z
  .object({
    primary: hexColor.or(z.literal("")).default(""),
    secondary: hexColor.or(z.literal("")).default(""),
    accent: hexColor.or(z.literal("")).default(""),
  })
  .partial();

const platformTonesSchema = z
  .object({
    twitter: z.string().max(200).default(""),
    linkedin: z.string().max(200).default(""),
    instagram: z.string().max(200).default(""),
  })
  .partial();

const optionalUrl = z
  .string()
  .max(1000)
  .refine(
    (v) => v === "" || /^https?:\/\//u.test(v),
    "Must be a valid http(s) URL",
  )
  .optional();

// ── Permissive schema (auto-save) ─────────────────────────────────────────
// Used by PATCH /brand-kit. Every field optional, no minimums — auto-save
// must be able to write half-finished fields without failing.
export const partialBrandKitSchema = z
  .object({
    organizationId: z.string().optional(), // ignored — session is source of truth
    companyName: z.string().max(200).optional(),
    companyDescription: z.string().max(2000).optional(),
    valueProposition: z.string().max(500).optional(),
    industry: z.string().max(200).optional(),
    targetAudience: z.string().max(1000).optional(),
    brandVoice: z.string().max(200).optional(),
    logoUrl: z.string().max(1000).nullable().optional(),
    logoKey: z.string().max(500).nullable().optional(),
    mascotUrl: z.string().max(1000).nullable().optional(),
    mascotKey: z.string().max(500).nullable().optional(),
    brandColors: brandColorsSchema.optional(),
    platformTones: platformTonesSchema.optional(),
    competitors: z.array(z.string().min(1).max(500)).max(50).optional(),
    keyDifferentiators: z.string().max(2000).optional(),
    websiteUrl: optionalUrl,
    location: z.string().max(200).optional(),
    crawledContent: z.string().max(20000).nullable().optional(),
    crawledSummary: z.string().max(4000).nullable().optional(),
    crawlSource: z.string().max(50).nullable().optional(),
  })
  .strict();

// ── Strict schema (finalize / mark onboarded) ─────────────────────────────
// Used by POST /brand-kit/finalize. Enforces the depth needed to make agents
// useful out of the gate. We allow logo/mascot to be absent (uploads can lag),
// but the conceptual depth fields must be filled.
export const finalizeBrandKitSchema = z
  .object({
    companyName: z
      .string()
      .min(
        BRAND_KIT_MINS.companyName,
        `Company name needs at least ${BRAND_KIT_MINS.companyName} characters — agents struggle with anything shorter`,
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
    // Logo is required at finalize. Mascot stays optional.
    logoUrl: z.string().min(1, "Upload a logo").max(1000),
    logoKey: z.string().min(1).max(500),
    mascotUrl: z.string().max(1000).nullable().optional(),
    mascotKey: z.string().max(500).nullable().optional(),
    brandColors: brandColorsSchema.optional(),
    platformTones: platformTonesSchema.optional(),
    competitors: z.array(z.string().min(1).max(500)).max(50).optional(),
    keyDifferentiators: z
      .string()
      .min(
        BRAND_KIT_MINS.keyDifferentiators,
        `Why you, not them — bullets work (min ${BRAND_KIT_MINS.keyDifferentiators} chars)`,
      )
      .max(2000),
    websiteUrl: optionalUrl,
    location: z.string().max(200).optional(),
    // crawledContent / crawledSummary may be carried through finalize when the
    // user clicked Auto-fill in onboarding — both optional, both validated by
    // the partial schema's bounds (kept here loose since user can edit/clear).
    crawledContent: z.string().max(20000).nullable().optional(),
    crawledSummary: z.string().max(4000).nullable().optional(),
    crawlSource: z.string().max(50).nullable().optional(),
  })
  .strict();

// ── Asset finalize schema ─────────────────────────────────────────────────
// Called after the client has PUT the file directly to R2 via a presigned
// URL. The server only needs the key + URL to verify (HeadObject) and persist.
export const finalizeAssetSchema = z.object({
  kind: z.enum(["logo", "mascot"]),
  key: z.string().min(1).max(500),
  url: z.string().min(1).max(1000),
});

export type PartialBrandKitInput = z.infer<typeof partialBrandKitSchema>;
export type FinalizeBrandKitInput = z.infer<typeof finalizeBrandKitSchema>;
export type FinalizeAssetInput = z.infer<typeof finalizeAssetSchema>;
