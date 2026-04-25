"use client"

import { Textarea } from "@/components/ui/textarea"
import { RhfField } from "@/components/forms/RhfField"
import { CharCount } from "@/components/forms/CharCount"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"

import { StepShell } from "../_lib/step-shell"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step6")!

export default function Step6Landscape() {
  const { control } = useOnboardingForm()

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <div className="flex flex-col gap-5">
        <RhfField
          control={control}
          name="competitors"
          label="Competitors"
          description="Comma-separated. 3–5 is plenty."
        >
          {({ field, invalid, id }) => (
            <Textarea
              {...field}
              id={id}
              variant="brand"
              placeholder="Olipop, Poppi, Recess, Aura Bora"
              aria-invalid={invalid}
            />
          )}
        </RhfField>

        <RhfField
          control={control}
          name="keyDifferentiators"
          label="Key differentiators"
          description="Why you, not them. Concrete claims beat adjectives."
        >
          {({ field, invalid, id }) => (
            <>
              <Textarea
                {...field}
                id={id}
                variant="brand"
                rows={4}
                placeholder={
                  '• Only adaptogenic line with functional mushrooms\n• 0g sugar, not "low sugar"\n• Shipped in 100% recycled cans'
                }
                aria-invalid={invalid}
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.keyDifferentiators}
                max={2000}
                hint="Bullets work great"
              />
            </>
          )}
        </RhfField>
      </div>
    </StepShell>
  )
}
