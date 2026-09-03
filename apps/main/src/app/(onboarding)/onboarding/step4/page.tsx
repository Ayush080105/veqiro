"use client"

import { RhfField } from "@/components/forms/RhfField"
import { cn } from "@/lib/utils"

import { StepShell } from "../_lib/step-shell"
import { VOICES } from "../_lib/constants"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step4")!

export default function Step4Voice() {
  const { control } = useOnboardingForm()

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <RhfField control={control} name="brandVoice" label="Voice">
        {({ field }) => (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
          >
            {VOICES.map(({ v, d }) => {
              const active = field.value === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => field.onChange(v)}
                  className={cn(
                    "cursor-pointer rounded-xl border px-4 py-4 text-left transition-shadow",
                    active
                      ? "border-[var(--vq-line-2)] bg-[color-mix(in_srgb,var(--vq-pink)_18%,white)] shadow-[var(--vq-shadow)]"
                      : "border-[var(--vq-line-2)] bg-white shadow-none",
                  )}
                >
                  <div className="font-head text-lg">{v}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{d}</div>
                </button>
              )
            })}
          </div>
        )}
      </RhfField>
    </StepShell>
  )
}
