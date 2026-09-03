"use client"

import { Controller } from "react-hook-form"

import { authClient } from "@/lib/auth-client"
import { AssetUpload } from "@/components/forms/AssetUpload"
import { RhfField } from "@/components/forms/RhfField"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ColorPicker,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/kibo-ui/color-picker"
import { cn } from "@/lib/utils"

import { StepShell } from "../_lib/step-shell"
import { PRESET_PALETTES } from "../_lib/constants"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

// Kibo's ColorPicker emits [r, g, b, a] (alpha 0-1). We store hex strings.
const rgbaToHex = (rgba: [number, number, number, number?]): string => {
  const [r, g, b] = rgba
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

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
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <AssetUpload
                kind="logo"
                label="Logo *"
                hint="PNG or SVG · under 5MB"
                value={field.value}
                onChange={({ url, key }) => {
                  setValue("logoUrl", url, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                  setValue("logoKey", key, { shouldDirty: true })
                }}
                disabled={!organizationId}
              />
              {fieldState.error && (
                <p
                  role="alert"
                  className="font-mono text-[11px] text-destructive"
                >
                  {fieldState.error.message}
                </p>
              )}
            </div>
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
                    "flex cursor-pointer overflow-hidden rounded-lg border border-[var(--vq-line-2)] bg-white p-0 transition-shadow",
                    JSON.stringify(field.value) === JSON.stringify(p) &&
                      "shadow-[var(--vq-shadow)] ring-1 ring-[var(--vq-line-2)]",
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
                  <Popover>
                    <PopoverTrigger
                      type="button"
                      aria-label={`Open color picker for slot ${i + 1}`}
                      className="mb-1.5 h-16 w-full cursor-pointer rounded-lg border border-[var(--vq-line-2)] transition-shadow hover:shadow-[var(--vq-shadow)]"
                      style={{ background: c }}
                    />
                    <PopoverContent
                      className="w-72 p-3"
                      sideOffset={8}
                      align="start"
                    >
                      <ColorPicker
                        // Uncontrolled: kibo's value-sync useEffect mishandles
                        // RGB→HSL, so we feed defaultValue once per popover
                        // open and listen to onChange. Closing+reopening picks
                        // up the latest field state.
                        defaultValue={c}
                        onChange={(rgba) => {
                          const next: [string, string, string] = [
                            ...field.value,
                          ] as [string, string, string]
                          next[i] = rgbaToHex(
                            rgba as [number, number, number, number?],
                          )
                          field.onChange(next)
                        }}
                      >
                        <ColorPickerSelection className="h-32" />
                        <ColorPickerHue />
                        <div className="flex items-center gap-2">
                          <ColorPickerEyeDropper />
                          <ColorPickerOutput />
                          <ColorPickerFormat />
                        </div>
                      </ColorPicker>
                    </PopoverContent>
                  </Popover>
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
                    className="w-full rounded-md border border-[var(--vq-line-2)] bg-white px-2.5 py-2 font-mono text-xs"
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
