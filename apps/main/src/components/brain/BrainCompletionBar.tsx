"use client"

import { useMemo } from "react"

import type { BrainFormValues } from "@/lib/types"
import { FONT } from "@/components/veqiro/shared"

interface BrainCompletionBarProps {
  values: BrainFormValues
}

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
