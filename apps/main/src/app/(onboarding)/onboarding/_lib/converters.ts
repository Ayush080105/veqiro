import type { BrandKit } from "@/lib/types"
import type { OnboardingValues } from "@/lib/schemas/brand-kit"

export const DEFAULT_VALUES: OnboardingValues = {
  companyName: "",
  companyDescription: "",
  valueProposition: "",
  industry: "",
  targetAudience: "",
  brandVoice: "",
  websiteUrl: "",
  logoUrl: null,
  logoKey: null,
  mascotUrl: null,
  mascotKey: null,
  brandColors: ["#F06464", "#111111", "#EFE7D6"],
  competitors: "",
  keyDifferentiators: "",
  crawledSummary: null,
  crawledContent: null,
}

export function valuesToBrandKit(v: OnboardingValues): Partial<BrandKit> {
  return {
    companyName: v.companyName,
    companyDescription: v.companyDescription,
    valueProposition: v.valueProposition,
    industry: v.industry,
    targetAudience: v.targetAudience,
    brandVoice: v.brandVoice,
    logoUrl: v.logoUrl,
    logoKey: v.logoKey,
    mascotUrl: v.mascotUrl,
    mascotKey: v.mascotKey,
    brandColors: {
      primary: v.brandColors[0],
      secondary: v.brandColors[1],
      accent: v.brandColors[2],
    },
    platformTones: { twitter: "", linkedin: "", instagram: "" },
    competitors: v.competitors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    keyDifferentiators: v.keyDifferentiators,
    websiteUrl: v.websiteUrl,
    crawledSummary: v.crawledSummary ?? null,
    crawledContent: v.crawledContent ?? null,
  }
}

export function brandKitToValues(k: BrandKit): OnboardingValues {
  const c = k.brandColors ?? {}
  return {
    companyName: k.companyName ?? "",
    companyDescription: k.companyDescription ?? "",
    valueProposition: k.valueProposition ?? "",
    industry: k.industry ?? "",
    targetAudience: k.targetAudience ?? "",
    brandVoice: k.brandVoice ?? "",
    websiteUrl: k.websiteUrl ?? "",
    logoUrl: k.logoUrl ?? null,
    logoKey: k.logoKey ?? null,
    mascotUrl: k.mascotUrl ?? null,
    mascotKey: k.mascotKey ?? null,
    brandColors: [
      c.primary ?? "#F06464",
      c.secondary ?? "#111111",
      c.accent ?? "#EFE7D6",
    ],
    competitors: (k.competitors ?? []).join(", "),
    keyDifferentiators: k.keyDifferentiators ?? "",
    crawledSummary: k.crawledSummary ?? null,
    crawledContent: k.crawledContent ?? null,
  }
}
