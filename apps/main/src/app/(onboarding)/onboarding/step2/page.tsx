"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RhfField } from "@/components/forms/RhfField"
import { CharCount } from "@/components/forms/CharCount"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"

import { StepShell } from "../_lib/step-shell"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step2")!

export default function Step2Identity() {
  const { control } = useOnboardingForm()

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <div className="flex flex-col gap-5">
        <RhfField control={control} name="companyName" label="Company name">
          {({ field, invalid, id }) => (
            <Input
              {...field}
              id={id}
              variant="brand"
              placeholder="e.g. Lumen Beverage Co."
              aria-invalid={invalid}
            />
          )}
        </RhfField>

        <RhfField
          control={control}
          name="companyDescription"
          label="Company description"
          description="What you make, for who. Aim for 1–2 specific sentences."
        >
          {({ field, invalid, id }) => (
            <>
              <Textarea
                {...field}
                id={id}
                variant="brand"
                rows={4}
                placeholder="We make adaptogenic sparkling drinks for people who quit coffee but still want to vibrate."
                aria-invalid={invalid}
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.companyDescription}
                max={2000}
                hint="Concrete > generic"
              />
            </>
          )}
        </RhfField>

        <RhfField control={control} name="websiteUrl" label="Website">
          {({ field, invalid, id }) => (
            <Input
              {...field}
              id={id}
              variant="brand"
              placeholder="https://lumen.co"
              aria-invalid={invalid}
            />
          )}
        </RhfField>
      </div>
    </StepShell>
  )
}
