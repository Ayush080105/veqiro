"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"

interface BrainCompletionBarProps {
  values: BrainFormValues
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScore(values: BrainFormValues) {
  let score = 0

  if (values.company_name.trim()) score += 15
  if (values.company_description.trim()) score += 10
  if (values.website_url.trim()) score += 5
  if (values.industry.trim()) score += 5
  if (values.target_audience.trim()) score += 15
  if (values.brand_voice !== "Professional") score += 5
  if (values.platform_tones.twitter.trim()) score += 3
  if (values.platform_tones.linkedin.trim()) score += 3
  if (values.platform_tones.instagram.trim()) score += 3
  if (values.brand_colors.primary !== "#000000") score += 2
  if (values.brand_colors.secondary !== "#ffffff") score += 2
  if (values.brand_colors.accent !== "#888888") score += 2
  if (values.competitors.length >= 1) score += 10
  if (values.key_differentiators.trim()) score += 10
  if (values.competitors.length > 3) score += 10

  return Math.min(100, Math.round(score))
}

function getNextSuggestion(values: BrainFormValues): string | null {
  if (!values.company_name.trim())
    return "Start by adding your company name so agents know who they represent."
  if (!values.target_audience.trim())
    return "Add your target audience to help agents personalize content."
  if (!values.company_description.trim())
    return "Describe your company so agents can craft accurate messaging."
  if (values.competitors.length < 1)
    return "Add at least one competitor to unlock competitive positioning."
  if (!values.key_differentiators.trim())
    return "Describe what makes you different from the competition."
  if (!values.industry.trim())
    return "Set your industry to improve market research accuracy."
  if (values.brand_voice === "Professional")
    return "Customize your brand voice to move beyond the default."
  if (!values.platform_tones.twitter.trim())
    return "Define your Twitter/X tone for platform-specific content."
  if (!values.platform_tones.linkedin.trim())
    return "Set your LinkedIn tone for professional posts."
  if (!values.platform_tones.instagram.trim())
    return "Set your Instagram tone for visual content."
  if (values.brand_colors.primary === "#000000")
    return "Pick your brand's primary color for generated assets."
  if (values.competitors.length <= 3)
    return "Add more competitors to unlock the bonus completion points."
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainCompletionBar({ values }: BrainCompletionBarProps) {
  const percentage = useMemo(() => computeScore(values), [values])
  const suggestion = useMemo(() => getNextSuggestion(values), [values])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Brand Kit Completion
        </span>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {percentage}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage < 100 && suggestion && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {suggestion}
        </p>
      )}
    </div>
  )
}
