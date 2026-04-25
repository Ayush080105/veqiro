"use client"

import { Controller } from "react-hook-form"

import { authClient } from "@/lib/auth-client"
import { AssetUpload } from "@/components/forms/AssetUpload"
import { RhfField } from "@/components/forms/RhfField"
import { cn } from "@/lib/utils"

import { StepShell } from "../_lib/step-shell"
import { PRESET_PALETTES } from "../_lib/constants"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step5")!

export default function Step5Visual() {
  const { control, setValue } = useOnboardingForm()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <Controller
          name="logoUrl"
          control={control}
          render={({ field }) => (
            <AssetUpload
              kind="logo"
              label="Logo"
              hint="PNG or SVG · under 5MB"
              value={field.value}
              onChange={({ url, key }) => {
                setValue("logoUrl", url, { shouldDirty: true })
                setValue("logoKey", key, { shouldDirty: true })
              }}
              disabled={!organizationId}
            />
          )}
        />
        <Controller
          name="mascotUrl"
          control={control}
          render={({ field }) => (
            <AssetUpload
              kind="mascot"
              label="Mascot (optional)"
              hint="A character that lives in your brand"
              value={field.value}
              onChange={({ url, key }) => {
                setValue("mascotUrl", url, { shouldDirty: true })
                setValue("mascotKey", key, { shouldDirty: true })
              }}
              disabled={!organizationId}
            />
          )}
        />
      </div>

      <RhfField
        control={control}
        name="brandColors"
        label="Brand colors"
        description="Click a preset or edit hex values"
      >
        {({ field }) => (
          <>
            <div className="mb-3 flex flex-wrap gap-2.5">
              {PRESET_PALETTES.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => field.onChange([...p] as [string, string, string])}
                  className={cn(
                    "flex cursor-pointer overflow-hidden rounded-lg border-[3px] border-foreground bg-white p-0",
                    JSON.stringify(field.value) === JSON.stringify(p) &&
                      "shadow-[4px_4px_0_var(--foreground)]",
                  )}
                >
                  {p.map((c) => (
                    <div key={c} className="size-7" style={{ background: c }} />
                  ))}
                </button>
              ))}
            </div>
            <div className="flex gap-2.5">
              {field.value.map((c, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="mb-1.5 h-16 rounded-lg border-[3px] border-foreground"
                    style={{ background: c }}
                  />
                  <input
                    value={c}
                    onChange={(e) => {
                      const next: [string, string, string] = [...field.value] as [
                        string,
                        string,
                        string,
                      ]
                      next[i] = e.target.value
                      field.onChange(next)
                    }}
                    className="w-full rounded-md border-2 border-foreground bg-white px-2.5 py-2 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </RhfField>
    </StepShell>
  )
}
