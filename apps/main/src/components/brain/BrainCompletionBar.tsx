"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"
import { FONT } from "@/lib/fonts"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"

interface BrainCompletionBarProps {
  values: BrainFormValues
}

// Weights are tuned to match what makes agents actually useful, not just to
// reach 100%. Depth fields (description / audience / differentiators) carry
// more than colour pickers because they're what calibrates the LLM.
function computeScore(values: BrainFormValues) {
  let score = 0

  if (values.companyName.trim()) score += 10
  if (values.companyDescription.trim().length >= BRAND_KIT_MINS.companyDescription)
    score += 15
  else if (values.companyDescription.trim()) score += 5

  if (values.targetAudience.trim().length >= BRAND_KIT_MINS.targetAudience)
    score += 15
  else if (values.targetAudience.trim()) score += 5

  if (values.brandVoice && values.brandVoice !== "Professional") score += 10
  else if (values.brandVoice) score += 5

  if (values.keyDifferentiators.trim().length >= BRAND_KIT_MINS.keyDifferentiators)
    score += 15
  else if (values.keyDifferentiators.trim()) score += 5

  if (values.competitors.length >= 1) score += 5
  if (values.competitors.length >= 3) score += 5

  if (values.industry.trim()) score += 5

  if (values.websiteUrl.trim()) score += 5

  if (
    values.platformTones.twitter.trim() ||
    values.platformTones.linkedin.trim() ||
    values.platformTones.instagram.trim()
  )
    score += 5

  if (
    values.brandColors.primary &&
    values.brandColors.primary !== "#000000" &&
    values.brandColors.secondary &&
    values.brandColors.accent
  )
    score += 5

  if (values.logoUrl) score += 3
  if (values.mascotUrl) score += 2

  return Math.min(100, Math.round(score))
}

function getNextSuggestion(values: BrainFormValues): string | null {
  if (!values.companyName.trim())
    return "Start with the company name so agents know who they represent."
  if (values.companyDescription.trim().length < BRAND_KIT_MINS.companyDescription)
    return `Beef up the description (≥${BRAND_KIT_MINS.companyDescription} chars) so agents can ground their messaging.`
  if (values.targetAudience.trim().length < BRAND_KIT_MINS.targetAudience)
    return `Add more on the audience (≥${BRAND_KIT_MINS.targetAudience} chars) — job titles, company size, motivations.`
  if (values.keyDifferentiators.trim().length < BRAND_KIT_MINS.keyDifferentiators)
    return `Spell out differentiators (≥${BRAND_KIT_MINS.keyDifferentiators} chars). Why you, not them.`
  if (values.competitors.length < 1)
    return "Add at least one competitor to unlock competitive positioning."
  if (!values.industry.trim())
    return "Set your industry to improve market research accuracy."
  if (!values.brandVoice || values.brandVoice === "Professional")
    return "Customize your brand voice to move beyond the default."
  if (!values.logoUrl)
    return "Upload a logo so Maya can use it in generated images."
  if (
    !values.platformTones.twitter.trim() &&
    !values.platformTones.linkedin.trim() &&
    !values.platformTones.instagram.trim()
  )
    return "Define a per-platform tone for sharper social copy."
  if (!values.brandColors.primary || values.brandColors.primary === "#000000")
    return "Pick your brand's primary color for generated assets."
  if (values.competitors.length < 3)
    return "Add 2 more competitors for sharper Scout outputs."
  return null
}

export function BrainCompletionBar({ values }: BrainCompletionBarProps) {
  const percentage = useMemo(() => computeScore(values), [values])
  const suggestion = useMemo(() => getNextSuggestion(values), [values])

  const fillColor =
    percentage >= 80
      ? "var(--vq-green)"
      : percentage >= 40
        ? "var(--vq-yellow)"
        : "var(--vq-red)"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
          }}
        >
          brand kit completion
        </span>
        <span
          style={{
            fontFamily: FONT.head,
            fontSize: 14,
            color: "#111",
          }}
        >
          {percentage}%
        </span>
      </div>

      <div
        style={{
          height: 14,
          width: "100%",
          background: "#FFF9ED",
          border: "2.5px solid #111",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: fillColor,
            width: `${percentage}%`,
            borderRight: percentage > 0 && percentage < 100 ? "2px solid #111" : "none",
            transition: "width 500ms ease",
          }}
        />
      </div>

      {percentage < 100 && suggestion && (
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            lineHeight: 1.5,
            color: "#555",
            margin: 0,
          }}
        >
          {`// ${suggestion}`}
        </p>
      )}
    </div>
  )
}
