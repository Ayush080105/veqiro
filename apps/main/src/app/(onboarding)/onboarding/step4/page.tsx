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
                    "cursor-pointer rounded-xl border-[3px] border-foreground px-4 py-4 text-left transition-transform",
                    active
                      ? "bg-[color:var(--vq-pink)] -translate-x-0.5 -translate-y-0.5 shadow-[5px_5px_0_var(--foreground)]"
                      : "bg-white shadow-none",
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
