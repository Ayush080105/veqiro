"use client"

import * as React from "react"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup } from "@/components/ui/field"
import {
  PlatformPicker,
  PlatformMultiPicker,
  CountedTextarea,
} from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import {
  mayaIdeationSchema,
  type MayaIdeationValues,
  mayaDraftSchema,
  type MayaDraftValues,
  mayaVariantsSchema,
  type MayaVariantsValues,
  mayaReviseSchema,
  type MayaReviseValues,
  mayaImageRegenSchema,
  type MayaImageRegenValues,
  mayaContentRegenSchema,
  type MayaContentRegenValues,
} from "@/lib/schemas/agents/maya"
import type { ContentPlatform } from "@/lib/types/agents"
import { uploadToR2 } from "@/lib/api/uploads"

const limitHint: Record<ContentPlatform, string> = {
  linkedin: "Max 3000 chars, 3-5 hashtags.",
  twitter: "Max 280 chars, 1-3 hashtags.",
  instagram: "Max 2200 chars, 15-30 hashtags.",
}

// ─── Ideation ───────────────────────────────────────────────────────────────

export function MayaIdeationForm({
  value,
  onChange,
}: {
  value: MayaIdeationValues
  onChange: (patch: Partial<MayaIdeationValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaIdeationSchema,
    defaultValue: value,
    onChange,
  })

  const useBrandkit = form.watch("use_brandkit") ?? false

  return (
    <FieldGroup>
      <RhfField control={form.control} name="platform" label="Platform" required>
        {({ field }) => (
          <PlatformPicker
            value={field.value}
            onChange={(p) => field.onChange(p)}
          />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="use_brandkit"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Use brandkit
              <span className="ml-1 text-[10px] opacity-60">Maya reads your company profile</span>
            </span>
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
            />
          </label>
        )}
      />

      <RhfField control={form.control} name="topic_hint" label="Topic hint">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder={useBrandkit ? "Locked — using brandkit" : "Leave blank for general brand ideas"}
            aria-invalid={invalid}
            disabled={useBrandkit}
            className={useBrandkit ? "opacity-50 cursor-not-allowed" : ""}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="count"
        label="How many ideas?"
        description="1-10"
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={10}
            value={field.value ?? 5}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Draft ──────────────────────────────────────────────────────────────────

export function MayaDraftForm({
  value,
  onChange,
}: {
  value: MayaDraftValues
  onChange: (patch: Partial<MayaDraftValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaDraftSchema,
    defaultValue: value,
    onChange,
  })

  const platform = form.watch("platform")
  const includeImage = form.watch("include_image") ?? true

  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const inspirationImages = form.watch("inspiration_images") ?? []
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    const urls: string[] = []
    for (const file of files) {
      const result = await uploadToR2("inspiration", file)
      if (result.ok) {
        urls.push(result.publicUrl)
      } else {
        setUploadError(result.message)
        break
      }
    }
    if (urls.length) {
      form.setValue("inspiration_images", [...inspirationImages, ...urls])
    }
    setUploading(false)
    e.target.value = ""
  }

  function removeInspiration(url: string) {
    form.setValue(
      "inspiration_images",
      inspirationImages.filter((u) => u !== url),
    )
  }

  return (
    <FieldGroup>
      <RhfField control={form.control} name="topic" label="Topic" required>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. Announcing our launch"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="platform"
        label="Platform"
        required
        description={limitHint[platform]}
      >
        {({ field }) => (
          <PlatformPicker value={field.value} onChange={field.onChange} />
        )}
      </RhfField>

      <RhfField control={form.control} name="tone_override" label="Tone override">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. confident but warm"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="word_count_target"
        label="Word count target"
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={20}
            max={2000}
            value={field.value ?? 200}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="additional_context"
        label="Additional context"
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={3}
            onChange={field.onChange}
            placeholder="Anything Maya should know — product launch, audience, angle, etc."
          />
        )}
      </RhfField>

      <div className="flex flex-wrap items-center gap-4">
        <Controller
          control={form.control}
          name="include_image"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
              Generate image
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="use_logo"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Overlay logo
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="use_mascot"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Add mascot
            </label>
          )}
        />
      </div>

      {includeImage && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Inspiration images
              <span className="ml-1 opacity-60">(optional, max 5)</span>
            </span>
            <button
              type="button"
              disabled={uploading || inspirationImages.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "Add images"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          {inspirationImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {inspirationImages.map((url) => (
                <div key={url} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-14 w-14 rounded object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeInspiration(url)}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FieldGroup>
  )
}

// ─── Variants ───────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  instagram: "Instagram",
}

export function MayaVariantsForm({
  value,
  onChange,
}: {
  value: MayaVariantsValues
  onChange: (patch: Partial<MayaVariantsValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaVariantsSchema,
    defaultValue: value,
    onChange,
  })

  // Read original platform from prop — not from form.watch (avoids undefined race)
  const originalPlatform = value.original_platform

  // Auto-remove the original platform from target_platforms on open / change.
  React.useEffect(() => {
    const current = form.getValues("target_platforms")
    const filtered = current.filter((p) => p !== originalPlatform)
    if (filtered.length !== current.length) {
      form.setValue("target_platforms", filtered, { shouldDirty: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalPlatform])

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="original_content"
        label="Original content"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={6}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="target_platforms"
        label="Adapt to"
        required
        description={`Adapting from ${PLATFORM_LABEL[originalPlatform] ?? originalPlatform}`}
      >
        {({ field }) => (
          <PlatformMultiPicker
            value={field.value}
            onChange={field.onChange}
            exclude={[originalPlatform]}
          />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="include_images"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
            />
            Generate per-platform images
          </label>
        )}
      />
    </FieldGroup>
  )
}

// ─── Revise ─────────────────────────────────────────────────────────────────

export function MayaReviseForm({
  value,
  onChange,
}: {
  value: MayaReviseValues
  onChange: (patch: Partial<MayaReviseValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaReviseSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="original_content"
        label="Original content"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={5}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="platform"
        label="Platform"
        required
      >
        {({ field }) => (
          <PlatformPicker value={field.value} onChange={field.onChange} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="feedback"
        label="Feedback"
        required
        description="What do you want changed?"
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="e.g. More punchy opener, drop the jargon, add a CTA."
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="specific_instructions"
        label="Specific instructions"
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={2}
            onChange={field.onChange}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Image regen ────────────────────────────────────────────────────────────

export function MayaImageRegenForm({
  value,
  onChange,
}: {
  value: MayaImageRegenValues
  onChange: (patch: Partial<MayaImageRegenValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaImageRegenSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="prompt"
        label="New prompt"
        required
        description="Describe the image you want generated."
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value ?? ""}
            rows={3}
            onChange={field.onChange}
            placeholder="e.g. Bold product shot with dark background and brand colours."
          />
        )}
      </RhfField>

      <div className="flex items-center gap-4">
        <Controller
          control={form.control}
          name="use_logo"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Overlay logo
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="use_mascot"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Add mascot
            </label>
          )}
        />
      </div>
    </FieldGroup>
  )
}

// ─── Content regen ──────────────────────────────────────────────────────────

export function MayaContentRegenForm({
  value,
  onChange,
}: {
  value: MayaContentRegenValues
  onChange: (patch: Partial<MayaContentRegenValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaContentRegenSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="caption"
        label="Existing caption"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="prompt"
        label="Rewrite prompt"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="e.g. Make it shorter and punchier; keep hashtags."
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="platform"
        label="Platform"
        required
      >
        {({ field }) => (
          <PlatformPicker value={field.value} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}
