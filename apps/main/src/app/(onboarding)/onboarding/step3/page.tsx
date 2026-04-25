"use client"

import { Textarea } from "@/components/ui/textarea"
import { RhfField } from "@/components/forms/RhfField"
import { CharCount } from "@/components/forms/CharCount"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"

import { StepShell } from "../_lib/step-shell"
import { Chip } from "../_lib/chip"
import { INDUSTRIES } from "../_lib/constants"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step3")!

export default function Step3Audience() {
  const { control } = useOnboardingForm()

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <RhfField control={control} name="industry" label="Industry">
        {({ field }) => (
          <div className="flex flex-wrap gap-2.5">
            {INDUSTRIES.map((i) => (
              <Chip
                key={i}
                active={field.value === i}
                onClick={() => field.onChange(i)}
                color="#6FCDE8"
              >
                {i}
              </Chip>
            ))}
          </div>
        )}
      </RhfField>

      <div className="mt-5">
        <RhfField
          control={control}
          name="targetAudience"
          label="Target audience"
          description="Who buys this? Job titles, motivations, where they live online."
        >
          {({ field, invalid, id }) => (
            <>
              <Textarea
                {...field}
                id={id}
                variant="brand"
                rows={4}
                placeholder="Urban 25–34 wellness-curious folks who read labels and follow 3+ nutritionists on TikTok."
                aria-invalid={invalid}
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.targetAudience}
                max={1000}
                hint="Specifics make Maya's posts land"
              />
            </>
          )}
        </RhfField>
      </div>
    </StepShell>
  )
}
