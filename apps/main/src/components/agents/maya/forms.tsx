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

      <RhfField control={form.control} name="topic_hint" label="Topic hint">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="Leave blank for general brand ideas"
            aria-invalid={invalid}
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
    </FieldGroup>
  )
}

// ─── Variants ───────────────────────────────────────────────────────────────

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
        name="original_platform"
        label="Original platform"
        required
      >
        {({ field }) => (
          <PlatformPicker value={field.value} onChange={field.onChange} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="target_platforms"
        label="Target platforms"
        required
      >
        {({ field }) => (
          <PlatformMultiPicker
            value={field.value}
            onChange={field.onChange}
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
        name="image_url"
        label="Existing image URL"
        required
      >
        {({ field, invalid, id }) => (
          <Input {...field} id={id} type="url" aria-invalid={invalid} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="prompt"
        label="New prompt"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="Describe the image you want."
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
