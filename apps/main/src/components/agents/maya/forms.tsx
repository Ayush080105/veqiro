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
import type { ActionStage } from "@/components/chat/ActionDialog"
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
  mayaGenerateVideoSchema,
  type MayaGenerateVideoValues,
  mayaCampaignVideoSchema,
  type MayaCampaignVideoValues,
  mayaLogoAnimationSchema,
  type MayaLogoAnimationValues,
} from "@/lib/schemas/agents/maya"
import type { ContentPlatform, VideoAspectRatio } from "@/lib/types/agents"
import { uploadToR2 } from "@/lib/api/uploads"
import { expandCampaignBrief, useLogoAnimationStyles } from "@/lib/api/assistants"
import { toast } from "sonner"
import { BrandImagesSelector } from "@/components/agents/maya/BrandImagesSelector"
import { useMayaRemainingCredits } from "@/lib/api/billing"

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
  onDisableSubmit,
}: {
  value: MayaDraftValues
  onChange: (patch: Partial<MayaDraftValues>) => void
  onDisableSubmit?: (disabled: boolean) => void
}) {
  const form = useAgentForm({
    schema: mayaDraftSchema,
    defaultValue: value,
    onChange,
  })

  const platforms = form.watch("platforms") as ContentPlatform[]
  const includeImage = form.watch("include_image") ?? true
  const makeCarousel = form.watch("make_carousel") ?? false
  const carouselCount = form.watch("carousel_count") ?? 3

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)
  const noCreditsLeft = creditsRemaining === 0
  const requestedImages = includeImage ? (makeCarousel ? carouselCount : 1) : 0
  const requestedCredits = requestedImages * 2
  const overLimit = creditsRemaining !== null && requestedCredits > creditsRemaining

  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  React.useEffect(() => {
    if (noCreditsLeft && includeImage) form.setValue("include_image", false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noCreditsLeft])

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
        name="platforms"
        label="Platform"
        required
        description={platforms?.length === 1 ? limitHint[platforms[0]] : undefined}
      >
        {({ field }) => (
          <PlatformPicker
            value={(field.value as ContentPlatform[])?.[0] ?? "linkedin"}
            onChange={(p) => field.onChange([p])}
          />
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
            <label className={`flex items-center gap-2 text-xs ${noCreditsLeft ? "opacity-50 cursor-not-allowed" : ""}`}>
              <Switch
                checked={noCreditsLeft ? false : (field.value ?? true)}
                onCheckedChange={field.onChange}
                disabled={noCreditsLeft}
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
                checked={field.value ?? true}
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
          name="use_brand_colors"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
              Brand colours
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

      {overLimit && (
        <p className="text-xs text-destructive">
          {`This would use ${requestedCredits} credits, but only ${creditsRemaining} remain this period.`}
        </p>
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
  onDisableSubmit,
}: {
  value: MayaVariantsValues
  onChange: (patch: Partial<MayaVariantsValues>) => void
  onDisableSubmit?: (disabled: boolean) => void
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

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)
  const noCreditsLeft = creditsRemaining === 0
  const targetPlatforms = form.watch("target_platforms") ?? []
  const includeImages = form.watch("include_images") ?? false
  const requestedImages = includeImages ? targetPlatforms.length : 0
  const requestedCredits = requestedImages * 2
  const overLimit = creditsRemaining !== null && requestedCredits > creditsRemaining

  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  React.useEffect(() => {
    if (noCreditsLeft && includeImages) form.setValue("include_images", false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noCreditsLeft])

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
          <label className={`flex items-center gap-2 text-xs ${noCreditsLeft ? "opacity-50 cursor-not-allowed" : ""}`}>
            <Switch
              checked={noCreditsLeft ? false : (field.value ?? false)}
              onCheckedChange={field.onChange}
              disabled={noCreditsLeft}
            />
            Generate per-platform images
          </label>
        )}
      />

      {overLimit && (
        <p className="text-xs text-destructive">
          {`This would use ${requestedCredits} credits, but only ${creditsRemaining} remain this period.`}
        </p>
      )}
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
  onDisableSubmit,
}: {
  value: MayaCampaignValues
  onChange: (patch: Partial<MayaCampaignValues>) => void
  onDisableSubmit?: (disabled: boolean) => void
}) {
  const form = useAgentForm({
    schema: mayaCampaignSchema,
    defaultValue: value,
    onChange,
  })

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const productImages = form.watch("product_image_urls") ?? []

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    const urls: string[] = []
    for (const file of files) {
      if (productImages.length + urls.length >= 5) break
      const result = await uploadToR2("inspiration", file)
      if (result.ok) {
        urls.push(result.publicUrl)
      } else {
        setUploadError(result.message)
        break
      }
    }
    if (urls.length) {
      form.setValue("product_image_urls" as never, [...productImages, ...urls] as never)
    }
    setUploading(false)
    e.target.value = ""
  }

  function removeProductImage(url: string) {
    form.setValue(
      "product_image_urls" as never,
      productImages.filter((u) => u !== url) as never
    )
  }

  const photoCount = form.watch("photo_count")
  const useLogo = form.watch("use_logo")
  const useMascot = form.watch("use_mascot")
  const [expanding, setExpanding] = React.useState(false)

  const overLimit = creditsRemaining !== null && photoCount * 2 > creditsRemaining
  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  const handleExpand = async () => {
    const brief = form.getValues("campaign_brief" as never) as unknown as string
    const platform = form.getValues("platform" as never) as unknown as string
    if (!brief?.trim()) {
      toast.error("Write a campaign brief first.")
      return
    }
    if (!orgId) {
      toast.error("Missing organization context — try reopening this dialog.")
      return
    }
    if (brief.length > 500) {
      toast.error("Brief is too long to expand (500 char max) — shorten it first.")
      return
    }
    setExpanding(true)
    try {
      // Pass the R2 URL directly — the backend fetches it server-side, avoiding the
      // browser CORS failures that block client-side fetches of R2-hosted images.
      const expanded = await expandCampaignBrief(orgId, brief, platform ?? "instagram", productImages[0])
      form.setValue("campaign_brief" as never, expanded as never)
      onChange({ campaign_brief: expanded } as never)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to expand brief — try again.")
    } finally {
      setExpanding(false)
    }
  }

  return (
    <FieldGroup>
      {/* Product Image Upload */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Product Images <span className="text-destructive">*</span></span>
          <button
            type="button"
            disabled={uploading || productImages.length >= 5}
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
        <span className="text-[10px] text-muted-foreground opacity-60">Up to 5 photos — different angles help the model get the product right.</span>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        {productImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {productImages.map((url) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="Product"
                  className="h-16 w-16 rounded object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeProductImage(url)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
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
          {PHOTO_COUNT_OPTIONS.map((n) => {
            const exceedsRemaining = creditsRemaining !== null && n * 2 > creditsRemaining
            return (
              <button
                key={n}
                type="button"
                disabled={exceedsRemaining}
                onClick={() => form.setValue("photo_count" as never, n as never)}
                className={`flex-1 py-1.5 text-xs rounded transition-colors ${exceedsRemaining ? "opacity-40 cursor-not-allowed" : ""}`}
                style={{
                  border: "2px solid var(--border)",
                  background: photoCount === n ? "var(--foreground)" : "transparent",
                  color: photoCount === n ? "var(--background)" : "var(--foreground)",
                  fontWeight: photoCount === n ? 700 : 400,
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        {overLimit && (
          <p className="text-xs text-destructive">
            {`This would use ${photoCount * 2} credits, but only ${creditsRemaining} remain this period.`}
          </p>
        )}
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

      {/* Brand colours */}
      <Controller
        control={form.control}
        name="use_brand_colors"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Brand colours
              <span className="ml-1 text-[10px] opacity-60">apply palette to photos</span>
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

// ─── Video ──────────────────────────────────────────────────────────────────

const ASPECT_RATIO_OPTIONS: { value: VideoAspectRatio; label: string }[] = [
  { value: "9:16", label: "Portrait (9:16)" },
  { value: "16:9", label: "Landscape (16:9)" },
]

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: VideoAspectRatio
  onChange: (v: VideoAspectRatio) => void
}) {
  return (
    <div className="flex gap-1.5">
      {ASPECT_RATIO_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 text-xs rounded transition-colors"
          style={{
            border: "2px solid var(--border)",
            background: value === opt.value ? "var(--foreground)" : "transparent",
            color: value === opt.value ? "var(--background)" : "var(--foreground)",
            fontWeight: value === opt.value ? 700 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const DURATION_OPTIONS = [4, 6, 8, 10] as const

function DurationPicker({
  value,
  onChange,
  maxAllowed,
}: {
  value: number
  onChange: (v: number) => void
  /** Durations above this remaining-seconds ceiling render disabled. */
  maxAllowed?: number
}) {
  return (
    <div className="flex gap-1.5">
      {DURATION_OPTIONS.map((n) => {
        const exceedsRemaining = maxAllowed !== undefined && n > maxAllowed
        return (
          <button
            key={n}
            type="button"
            disabled={exceedsRemaining}
            onClick={() => onChange(n)}
            className={`flex-1 py-1.5 text-xs rounded transition-colors ${exceedsRemaining ? "opacity-40 cursor-not-allowed" : ""}`}
            style={{
              border: "2px solid var(--border)",
              background: value === n ? "var(--foreground)" : "transparent",
              color: value === n ? "var(--background)" : "var(--foreground)",
              fontWeight: value === n ? 700 : 400,
            }}
          >
            {n}s
          </button>
        )
      })}
    </div>
  )
}

export function MayaGenerateVideoForm({
  value,
  onChange,
  onDisableSubmit,
}: {
  value: MayaGenerateVideoValues
  onChange: (patch: Partial<MayaGenerateVideoValues>) => void
  onDisableSubmit?: (disabled: boolean) => void
}) {
  const form = useAgentForm({
    schema: mayaGenerateVideoSchema,
    defaultValue: value,
    onChange,
  })

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)
  const durationSeconds = form.watch("duration_seconds")
  const requestedCredits = durationSeconds * 4
  const overLimit = creditsRemaining !== null && requestedCredits > creditsRemaining

  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  return (
    <FieldGroup>
      <RhfField control={form.control} name="prompt" label="Video prompt" required>
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
            placeholder="Describe the video you want (e.g. 'A barista pouring latte art in a cozy morning café, warm light, slow motion')"
          />
        )}
      </RhfField>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Aspect ratio</span>
        <Controller
          control={form.control}
          name="aspect_ratio"
          render={({ field }) => (
            <AspectRatioPicker value={field.value as VideoAspectRatio} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Duration</span>
        <Controller
          control={form.control}
          name="duration_seconds"
          render={({ field }) => (
            <DurationPicker
              value={field.value as number}
              onChange={field.onChange}
              maxAllowed={creditsRemaining === null ? undefined : Math.floor(creditsRemaining / 4)}
            />
          )}
        />
        {overLimit && (
          <p className="text-xs text-destructive">
            {`This would use ${requestedCredits} credits (${durationSeconds}s of video), but only ${creditsRemaining} remain this period.`}
          </p>
        )}
      </div>

      <Controller
        control={form.control}
        name="use_logo"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Overlay logo
              <span className="ml-1 text-[10px] opacity-60">from brand kit</span>
            </span>
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
          </label>
        )}
      />

      <RhfField control={form.control} name="platform" label="Platform" required>
        {({ field }) => (
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}

export function MayaCampaignVideoForm({
  value,
  onChange,
  submitting,
  stage,
  hideDuration,
  onDisableSubmit,
}: {
  value: MayaCampaignVideoValues
  onChange: (patch: Partial<MayaCampaignVideoValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
  /** Hide the duration picker — it has no visible effect on a still storyboard image. */
  hideDuration?: boolean
  onDisableSubmit?: (disabled: boolean) => void
}) {
  const form = useAgentForm({
    schema: mayaCampaignVideoSchema,
    defaultValue: value,
    onChange,
  })

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)
  const storyboardImageUrl = (value as Record<string, unknown>).storyboard_image_url as string | undefined
  const storyboardBeats = (value as Record<string, unknown>).storyboard_beats as string[] | undefined
  const durationSeconds = form.watch("duration_seconds")

  // A storyboard image still needs to be generated unless this form was prefilled
  // from a "Turn into video" reuse flow that already has both a URL and beats —
  // matches RunActionDialog's customSubmit regeneration condition exactly, so
  // the credit estimate here never under-predicts what actually gets charged.
  // Both costs draw from the same shared credit pool, so they must be checked
  // together — a duration that looks affordable on its own could still blow
  // the combined budget once the storyboard cost is added.
  const needsStoryboardImage = hideDuration === true || !storyboardImageUrl || !storyboardBeats?.length
  const storyboardCredits = needsStoryboardImage ? 2 : 0
  const videoCredits = !hideDuration ? durationSeconds * 4 : 0
  const requestedCredits = storyboardCredits + videoCredits
  const overLimit = creditsRemaining !== null && requestedCredits > creditsRemaining

  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const productImages = form.watch("product_image_urls") ?? []

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    const urls: string[] = []
    for (const file of files) {
      if (productImages.length + urls.length >= 5) break
      const result = await uploadToR2("inspiration", file)
      if (result.ok) {
        urls.push(result.publicUrl)
      } else {
        setUploadError(result.message)
        break
      }
    }
    if (urls.length) {
      form.setValue("product_image_urls" as never, [...productImages, ...urls] as never)
    }
    setUploading(false)
    e.target.value = ""
  }

  function removeProductImage(url: string) {
    form.setValue(
      "product_image_urls" as never,
      productImages.filter((u) => u !== url) as never
    )
  }

  const stageStoryboardUrl = (stage?.data as { storyboardImageUrl?: string } | undefined)?.storyboardImageUrl

  return (
    <FieldGroup>
      {submitting && stage && (
        <div className="flex flex-col items-center gap-2 rounded border border-border bg-muted/40 p-3">
          {stageStoryboardUrl ? (
            <img
              src={stageStoryboardUrl}
              alt="Storyboard preview"
              className="max-h-40 rounded border border-border object-contain"
            />
          ) : (
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <span className="text-xs text-muted-foreground">{stage.label}</span>
        </div>
      )}
      {/* Product Image Upload */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Product Images <span className="text-destructive">*</span></span>
          <button
            type="button"
            disabled={uploading || productImages.length >= 5}
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
        <span className="text-[10px] text-muted-foreground opacity-60">Up to 5 photos — different angles help the model get the product right.</span>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        {productImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {productImages.map((url) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="Product"
                  className="h-16 w-16 rounded object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeProductImage(url)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
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
        {overLimit && (
          <p className="text-xs text-destructive">
            {`This would use ${requestedCredits} credits total (storyboard image${!hideDuration ? " + video" : ""}), but only ${creditsRemaining} remain this period.`}
          </p>
        )}
      </div>

      <RhfField control={form.control} name="campaign_brief" label="Campaign brief" required>
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={4}
            onChange={field.onChange}
            placeholder="Describe your product, campaign goal, target audience, or vibe"
          />
        )}
      </RhfField>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Aspect ratio</span>
        <Controller
          control={form.control}
          name="aspect_ratio"
          render={({ field }) => (
            <AspectRatioPicker value={field.value as VideoAspectRatio} onChange={field.onChange} />
          )}
        />
      </div>

      {!hideDuration && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Duration</span>
          <Controller
            control={form.control}
            name="duration_seconds"
            render={({ field }) => (
              <DurationPicker
                value={field.value as number}
                onChange={field.onChange}
                maxAllowed={
                  creditsRemaining === null
                    ? undefined
                    : Math.floor(Math.max(0, creditsRemaining - storyboardCredits) / 4)
                }
              />
            )}
          />
        </div>
      )}

      <Controller
        control={form.control}
        name="use_logo"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Overlay logo
              <span className="ml-1 text-[10px] opacity-60">from brand kit</span>
            </span>
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
          </label>
        )}
      />

      <RhfField control={form.control} name="platform" label="Platform" required>
        {({ field }) => (
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}

export function MayaCampaignVideoStoryboardForm(props: {
  value: MayaCampaignVideoValues
  onChange: (patch: Partial<MayaCampaignVideoValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
  onDisableSubmit?: (disabled: boolean) => void
}) {
  return <MayaCampaignVideoForm {...props} hideDuration />
}

// ─── Logo Animation ─────────────────────────────────────────────────────────

const LOGO_ANIMATION_CREDITS = 40 // fixed 10s video * 4 credits/sec

export function MayaLogoAnimationForm({
  value,
  onChange,
  onDisableSubmit,
}: {
  value: MayaLogoAnimationValues
  onChange: (patch: Partial<MayaLogoAnimationValues>) => void
  submitting?: boolean
  stage?: ActionStage | null
  onDisableSubmit?: (disabled: boolean) => void
}) {
  const form = useAgentForm({
    schema: mayaLogoAnimationSchema,
    defaultValue: value,
    onChange,
  })

  const orgId = (value as Record<string, unknown>).organization_id as string
  const { creditsRemaining } = useMayaRemainingCredits(orgId)
  const { data: stylesData, isLoading: stylesLoading } = useLogoAnimationStyles()
  const overLimit = creditsRemaining !== null && LOGO_ANIMATION_CREDITS > creditsRemaining

  React.useLayoutEffect(() => {
    onDisableSubmit?.(overLimit)
  }, [overLimit, onDisableSubmit])

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const logoImageUrl = form.watch("logo_image_url")
  const useBrandLogo = form.watch("use_brand_logo")

  // Group the flat catalog into its categories, preserving the backend's order —
  // the catalog is already sorted by category (see core/logo_animation_styles.py).
  const groupedStyles = React.useMemo(() => {
    const styles = stylesData?.styles ?? []
    const groups: { category: string; styles: typeof styles }[] = []
    for (const s of styles) {
      const last = groups[groups.length - 1]
      if (last && last.category === s.category) last.styles.push(s)
      else groups.push({ category: s.category, styles: [s] })
    }
    return groups
  }, [stylesData])

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const result = await uploadToR2("inspiration", file)
    if (result.ok) {
      form.setValue("logo_image_url" as never, result.publicUrl as never)
      form.setValue("use_brand_logo" as never, false as never)
    } else {
      setUploadError(result.message)
    }
    setUploading(false)
    e.target.value = ""
  }

  return (
    <FieldGroup>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">
          Logo <span className="text-destructive">*</span>
        </span>
        {logoImageUrl && !useBrandLogo && (
          <img
            src={logoImageUrl}
            alt="Logo"
            className="h-16 w-16 self-start rounded border border-border bg-white object-contain"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? "Uploading…" : logoImageUrl && !useBrandLogo ? "Replace logo" : "Upload logo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoFile}
          />
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <Controller
          control={form.control}
          name="use_brand_logo"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Use brand kit logo instead</span>
              <Switch
                checked={field.value ?? false}
                onCheckedChange={(v) => {
                  field.onChange(v)
                  if (v) form.setValue("logo_image_url" as never, undefined as never)
                }}
              />
            </label>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">
          Animation style <span className="text-destructive">*</span>
        </span>
        {stylesLoading ? (
          <p className="text-xs text-muted-foreground">Loading styles…</p>
        ) : (
          <Controller
            control={form.control}
            name="style_id"
            render={({ field }) => (
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded border border-border p-2">
                {groupedStyles.map((g) => (
                  <div key={g.category} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.category}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {g.styles.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => field.onChange(s.id)}
                          className="rounded-full px-2.5 py-1 text-xs transition-colors"
                          style={{
                            border: "2px solid var(--border)",
                            background: field.value === s.id ? "var(--foreground)" : "transparent",
                            color: field.value === s.id ? "var(--background)" : "var(--foreground)",
                            fontWeight: field.value === s.id ? 700 : 400,
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Aspect ratio</span>
        <Controller
          control={form.control}
          name="aspect_ratio"
          render={({ field }) => (
            <AspectRatioPicker value={field.value as VideoAspectRatio} onChange={field.onChange} />
          )}
        />
      </div>

      {overLimit && (
        <p className="text-xs text-destructive">
          {`This uses ${LOGO_ANIMATION_CREDITS} credits (10s of video), but only ${creditsRemaining} remain this period.`}
        </p>
      )}

      <RhfField control={form.control} name="platform" label="Platform" required>
        {({ field }) => (
          <PlatformPicker value={field.value as ContentPlatform} onChange={field.onChange} />
        )}
      </RhfField>
    </FieldGroup>
  )
}