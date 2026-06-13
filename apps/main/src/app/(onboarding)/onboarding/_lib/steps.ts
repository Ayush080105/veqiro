// Single source of truth for the onboarding wizard.
//
// Each entry maps a URL slug to the form fields validated when the user
// clicks Continue on that step, plus the chrome (title / subtitle / emoji).
//
// Order is the source of truth for: progress bar, step counter, "first
// incomplete step" routing, prev/next button behaviour. Reorder the array to
// reorder the wizard.

import type { OnboardingValues } from "@/lib/schemas/brand-kit"

export type OnboardingFieldName = keyof OnboardingValues

export interface StepConfig {
  /** URL slug — final URL is /onboarding/${slug}. */
  slug: string
  /** 1-indexed step number for chrome ("Step 3 of 7"). */
  index: number
  emoji: string
  title: string
  subtitle?: string
  /**
   * RHF field names this step is responsible for. The Continue button on this
   * step calls form.trigger(fields) before advancing. Empty array means the
   * step is informational / outside RHF (step1 owns org creation).
   */
  fields: OnboardingFieldName[]
}

export const STEPS: StepConfig[] = [
  {
    slug: "step1",
    index: 1,
    emoji: "⁕",
    title: "Name your workspace",
    subtitle:
      "Your crew works inside a workspace. Name it whatever your team is called — you can rename later.",
    fields: [], // org creation is outside RHF
  },
  {
    slug: "step2",
    index: 2,
    emoji: "②",
    title: "Who's hiring us?",
    subtitle: "The basics. So your crew knows which company's voice to speak in.",
    fields: [
      "companyName",
      "companyDescription",
      "valueProposition",
      "websiteUrl",
    ],
  },
  {
    slug: "step3",
    index: 3,
    emoji: "③",
    title: "What industry are we in?",
    subtitle:
      "Pick one. The crew uses this to source benchmarks and avoid saying wild things.",
    fields: ["industry", "targetAudience"],
  },
  {
    slug: "step4",
    index: 4,
    emoji: "④",
    title: "How do you sound?",
    subtitle: "Pick a voice. We'll calibrate Maya and the rest. You can refine later.",
    fields: ["brandVoice"],
  },
  {
    slug: "step5",
    index: 5,
    emoji: "⑤",
    title: "Visual identity",
    subtitle: "Upload your logo and (optionally) a mascot. Pick a palette.",
    fields: ["logoUrl"], // logo required; mascot + palette optional
  },
  {
    slug: "step6",
    index: 6,
    emoji: "⑥",
    title: "The landscape",
    subtitle:
      "Who's in your arena, and why are you different? Scout & Maya will use this daily.",
    fields: ["keyDifferentiators"], // competitors is optional comma-list
  },
  {
    slug: "step7",
    index: 7,
    emoji: "✓",
    title: "All set. Ready to meet the crew?",
    subtitle:
      "Here's what the agents will learn on day one. You can edit anything later from the Brain page.",
    fields: [],
  },
]

export const TOTAL_STEPS = STEPS.length

export const FIRST_STEP = STEPS[0]
export const LAST_STEP = STEPS[STEPS.length - 1]

export function findStepBySlug(slug: string): StepConfig | undefined {
  return STEPS.find((s) => s.slug === slug)
}

export function nextStep(slug: string): StepConfig | undefined {
  const i = STEPS.findIndex((s) => s.slug === slug)
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : undefined
}

export function prevStep(slug: string): StepConfig | undefined {
  const i = STEPS.findIndex((s) => s.slug === slug)
  return i > 0 ? STEPS[i - 1] : undefined
}
