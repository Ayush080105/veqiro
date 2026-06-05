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
  mayaCampaignSchema,
  type MayaCampaignValues,
} from "@/lib/schemas/agents/maya"
import type { ContentPlatform } from "@/lib/types/agents"
import { uploadToR2 } from "@/lib/api/uploads"
import { expandCampaignBrief } from "@/lib/api/assistants"
import { BrandImagesSelector } from "@/components/agents/maya/BrandImagesSelector"

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
            value={field.value as ContentPlatform}
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
  const makeCarousel = form.watch("make_carousel") ?? false

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
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
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
        <Controller
          control={form.control}
          name="make_carousel"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Make carousel
            </label>
          )}
        />
      </div>

      {makeCarousel && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Slides</span>
          <Input
            type="number"
            min={2}
            max={8}
            value={form.watch("carousel_count") ?? 3}
            onChange={(e) =>
              form.setValue("carousel_count", Math.min(8, Math.max(2, Number(e.target.value))))
            }
            className="h-7 w-16 text-xs"
          />
          <span className="text-[10px] text-muted-foreground opacity-60">max 8</span>
        </div>
      )}

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

      {includeImage && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Brand images
            <span className="ml-1 opacity-60">(select from your saved assets)</span>
          </span>
          <BrandImagesSelector
            selected={form.watch("brand_image_ids") ?? []}
            prompts={form.watch("brand_image_prompts") ?? {}}
            onSelectionChange={(ids) => form.setValue("brand_image_ids", ids)}
            onPromptChange={(id, prompt) => {
              const current = form.getValues("brand_image_prompts") ?? {}
              if (prompt) {
                form.setValue("brand_image_prompts", { ...current, [id]: prompt })
              } else {
                const next = { ...current }
                delete next[id]
                form.setValue("brand_image_prompts", next)
              }
            }}
          />
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
            value={field.value as ContentPlatform[]}
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
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
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
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Campaign ───────────────────────────────────────────────────────────────

const PHOTO_COUNT_OPTIONS = [1, 2, 3, 4, 6] as const

export function MayaCampaignForm({
  value,
  onChange,
}: {
  value: MayaCampaignValues
  onChange: (patch: Partial<MayaCampaignValues>) => void
}) {
  const form = useAgentForm({
    schema: mayaCampaignSchema,
    defaultValue: value,
    onChange,
  })

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    form.setValue("product_image" as never, file as never)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  const photoCount = form.watch("photo_count")
  const useLogo = form.watch("use_logo")
  const useMascot = form.watch("use_mascot")
  const [expanding, setExpanding] = React.useState(false)

  const handleExpand = async () => {
    const brief = form.getValues("campaign_brief" as never) as unknown as string
    const platform = form.getValues("platform" as never) as unknown as string
    const orgId = (value as Record<string, unknown>).organization_id as string
    if (!brief?.trim() || !orgId) return
    setExpanding(true)
    try {
      const expanded = await expandCampaignBrief(orgId, brief, platform ?? "instagram")
      form.setValue("campaign_brief" as never, expanded as never)
      onChange({ campaign_brief: expanded } as never)
    } catch {
      // silently fail — user still has their original brief
    } finally {
      setExpanding(false)
    }
  }

  return (
    <FieldGroup>
      {/* Product Image Upload */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Upload Your Product Image</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {previewUrl ? (
          <div className="relative w-full">
            <img
              src={previewUrl}
              alt="Product preview"
              className="w-full max-h-40 object-cover rounded"
              style={{ border: "2px solid var(--border)", borderRadius: 6 }}
            />
            <button
              type="button"
              onClick={() => {
                form.setValue("product_image" as never, null as never)
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
              className="absolute top-1 right-1 text-xs bg-background border border-border rounded px-1.5 py-0.5 hover:bg-muted"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-1.5 rounded py-6 text-xs text-muted-foreground hover:bg-muted transition-colors"
            style={{ border: "2px dashed var(--border)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Click to upload — JPG, PNG, or WEBP</span>
          </button>
        )}
      </div>

      {/* Campaign Brief */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Campaign Brief <span className="text-destructive">*</span></span>
          <button
            type="button"
            onClick={handleExpand}
            disabled={expanding || !form.watch("campaign_brief" as never)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: "1.5px solid var(--border)" }}
          >
            {expanding ? (
              <>
                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Expanding…
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Expand with AI
              </>
            )}
          </button>
        </div>
        <RhfField
          control={form.control}
          name="campaign_brief"
          required
        >
          {({ field }) => (
            <CountedTextarea
              value={field.value}
              rows={4}
              onChange={field.onChange}
              placeholder="Describe your product, campaign goal, target audience, or vibe (e.g. 'Summer launch for a hydration drink targeting Gen Z athletes')"
            />
          )}
        </RhfField>
      </div>

      {/* Photo Count */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Number of Campaign Photos</span>
        <div className="flex gap-1.5">
          {PHOTO_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => form.setValue("photo_count" as never, n as never)}
              className="flex-1 py-1.5 text-xs rounded transition-colors"
              style={{
                border: "2px solid var(--border)",
                background: photoCount === n ? "var(--foreground)" : "transparent",
                color: photoCount === n ? "var(--background)" : "var(--foreground)",
                fontWeight: photoCount === n ? 700 : 400,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Logo overlay */}
      <Controller
        control={form.control}
        name="use_logo"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Overlay logo
              <span className="ml-1 text-[10px] opacity-60">from brand kit</span>
            </span>
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
          </label>
        )}
      />

      {/* Mascot overlay */}
      <Controller
        control={form.control}
        name="use_mascot"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Overlay mascot
              <span className="ml-1 text-[10px] opacity-60">from brand kit</span>
            </span>
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
          </label>
        )}
      />

      {/* Platform */}
      <RhfField
        control={form.control}
        name="platform"
        label="Platform"
        required
      >
        {({ field }) => (
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}