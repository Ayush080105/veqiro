"use client"

import { useRouter } from "next/navigation"
import { useWatch } from "react-hook-form"

import { StepShell } from "../_lib/step-shell"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step7")!

interface ReviewRow {
  label: string
  value: string
  /** Step slug to jump to when the user clicks "Edit". */
  jumpTo: string
}

export default function Step7Review() {
  const router = useRouter()
  const { control } = useOnboardingForm()
  // useWatch returns the latest values without subscribing the parent to every
  // change — the layout already does that for draft persistence.
  const v = useWatch({ control })

  const rows: ReviewRow[] = [
    { label: "Company", value: v.companyName || "—", jumpTo: "step2" },
    {
      label: "Value prop",
      value: v.valueProposition
        ? v.valueProposition.length > 80
          ? v.valueProposition.slice(0, 80) + "…"
          : v.valueProposition
        : "—",
      jumpTo: "step2",
    },
    { label: "Industry", value: v.industry || "—", jumpTo: "step3" },
    { label: "Voice", value: v.brandVoice || "—", jumpTo: "step4" },
    { label: "Website", value: v.websiteUrl || "—", jumpTo: "step2" },
    {
      label: "Site context",
      value: v.crawledSummary ? "captured ✓" : "—",
      jumpTo: "step2",
    },
    { label: "Logo", value: v.logoUrl ? "uploaded ✓" : "none", jumpTo: "step5" },
    { label: "Mascot", value: v.mascotUrl ? "uploaded ✓" : "none", jumpTo: "step5" },
  ]

  const palette = (v.brandColors as [string, string, string] | undefined) ?? [
    "#fff",
    "#fff",
    "#fff",
  ]

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle} bg="#F5E5C8">
      <div className="mb-5 rounded-xl border-[3px] border-foreground bg-white p-6">
        <div className="grid gap-3.5">
          {rows.map(({ label, value, jumpTo }) => (
            <div
              key={label}
              className="flex min-w-0 items-center gap-3 border-b border-dashed border-border pb-2.5"
            >
              <div className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </div>
              <div className="min-w-0 flex-1 truncate font-body text-[15px]">{value}</div>
              <button
                type="button"
                onClick={() => router.push(`/onboarding/${jumpTo}`)}
                className="shrink-0 cursor-pointer rounded-full border-2 border-foreground bg-secondary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
              >
                Edit
              </button>
            </div>
          ))}
          <div className="flex items-center">
            <div className="w-32 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Palette
            </div>
            <div className="flex gap-1.5">
              {palette.map((c, i) => (
                <div
                  key={i}
                  className="size-8 rounded-md border-2 border-foreground"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-xl border-[3px] border-foreground bg-foreground p-5 text-background">
        <div className="font-display text-5xl leading-none text-[color:var(--vq-yellow)]">6</div>
        <div>
          <div className="font-head text-base">AI employees ready to clock in</div>
          <div className="mt-1 font-mono text-xs opacity-70">
            vega · scout · maya · sage · lex · rex
          </div>
        </div>
      </div>
    </StepShell>
  )
}
