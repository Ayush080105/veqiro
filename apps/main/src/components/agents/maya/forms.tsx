"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  FormRow,
  PlatformPicker,
  PlatformMultiPicker,
  CountedTextarea,
} from "@/components/chat/ActionForm/fields"
import type {
  MayaIdeationRequest,
  MayaDraftRequest,
  MayaVariantRequest,
  MayaReviseRequest,
  MayaImageRegenRequest,
  MayaContentRegenRequest,
  ContentPlatform,
} from "@/lib/types/agents"

export function MayaIdeationForm({
  value,
  onChange,
}: {
  value: MayaIdeationRequest
  onChange: (patch: Partial<MayaIdeationRequest>) => void
}) {
  return (
    <>
      <FormRow label="Platform" required>
        <PlatformPicker
          value={value.platform}
          onChange={(p) => onChange({ platform: p })}
        />
      </FormRow>
      <FormRow label="Topic hint">
        <Input
          value={value.topic_hint ?? ""}
          placeholder="Leave blank for general brand ideas"
          onChange={(e) => onChange({ topic_hint: e.target.value })}
        />
      </FormRow>
      <FormRow label="How many ideas?">
        <Input
          type="number"
          min={1}
          max={10}
          value={value.count ?? 5}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
        />
      </FormRow>
    </>
  )
}

export function MayaDraftForm({
  value,
  onChange,
}: {
  value: MayaDraftRequest
  onChange: (patch: Partial<MayaDraftRequest>) => void
}) {
  const limitHint: Record<ContentPlatform, string> = {
    linkedin: "Max 3000 chars, 3-5 hashtags.",
    twitter: "Max 280 chars, 1-3 hashtags.",
    instagram: "Max 2200 chars, 15-30 hashtags.",
  }
  return (
    <>
      <FormRow label="Topic" required>
        <Input
          value={value.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          placeholder="e.g. Announcing our launch"
        />
      </FormRow>
      <FormRow label="Platform" required hint={limitHint[value.platform]}>
        <PlatformPicker
          value={value.platform}
          onChange={(p) => onChange({ platform: p })}
        />
      </FormRow>
      <FormRow label="Tone override">
        <Input
          value={value.tone_override ?? ""}
          placeholder="e.g. confident but warm"
          onChange={(e) => onChange({ tone_override: e.target.value })}
        />
      </FormRow>
      <FormRow label="Word count target">
        <Input
          type="number"
          min={20}
          max={2000}
          value={value.word_count_target ?? 200}
          onChange={(e) => onChange({ word_count_target: Number(e.target.value) })}
        />
      </FormRow>
      <FormRow label="Additional context">
        <CountedTextarea
          value={value.additional_context ?? ""}
          rows={3}
          onChange={(v) => onChange({ additional_context: v })}
          placeholder="Anything Maya should know — product launch, audience, angle, etc."
        />
      </FormRow>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.include_image ?? true}
            onCheckedChange={(v) => onChange({ include_image: v })}
          />
          Generate image
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.use_logo ?? false}
            onCheckedChange={(v) => onChange({ use_logo: v })}
          />
          Overlay logo
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.use_mascot ?? false}
            onCheckedChange={(v) => onChange({ use_mascot: v })}
          />
          Add mascot
        </label>
      </div>
    </>
  )
}

export function MayaVariantsForm({
  value,
  onChange,
}: {
  value: MayaVariantRequest
  onChange: (patch: Partial<MayaVariantRequest>) => void
}) {
  return (
    <>
      <FormRow label="Original content" required>
        <CountedTextarea
          value={value.original_content}
          rows={6}
          onChange={(v) => onChange({ original_content: v })}
        />
      </FormRow>
      <FormRow label="Original platform" required>
        <PlatformPicker
          value={value.original_platform}
          onChange={(p) => onChange({ original_platform: p })}
        />
      </FormRow>
      <FormRow label="Target platforms" required>
        <PlatformMultiPicker
          value={value.target_platforms}
          onChange={(next) => onChange({ target_platforms: next })}
        />
      </FormRow>
      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={value.include_images ?? false}
          onCheckedChange={(v) => onChange({ include_images: v })}
        />
        Generate per-platform images
      </label>
    </>
  )
}

export function MayaReviseForm({
  value,
  onChange,
}: {
  value: MayaReviseRequest
  onChange: (patch: Partial<MayaReviseRequest>) => void
}) {
  return (
    <>
      <FormRow label="Original content" required>
        <CountedTextarea
          value={value.original_content}
          rows={5}
          onChange={(v) => onChange({ original_content: v })}
        />
      </FormRow>
      <FormRow label="Platform" required>
        <PlatformPicker
          value={value.platform}
          onChange={(p) => onChange({ platform: p })}
        />
      </FormRow>
      <FormRow label="Feedback" required hint="What do you want changed?">
        <CountedTextarea
          value={value.feedback}
          rows={3}
          onChange={(v) => onChange({ feedback: v })}
          placeholder="e.g. More punchy opener, drop the jargon, add a CTA."
        />
      </FormRow>
      <FormRow label="Specific instructions">
        <CountedTextarea
          value={value.specific_instructions ?? ""}
          rows={2}
          onChange={(v) => onChange({ specific_instructions: v })}
        />
      </FormRow>
    </>
  )
}

export function MayaImageRegenForm({
  value,
  onChange,
}: {
  value: MayaImageRegenRequest
  onChange: (patch: Partial<MayaImageRegenRequest>) => void
}) {
  return (
    <>
      <FormRow label="Existing image URL" required>
        <Input
          type="url"
          value={value.image_url}
          onChange={(e) => onChange({ image_url: e.target.value })}
        />
      </FormRow>
      <FormRow label="New prompt" required>
        <CountedTextarea
          value={value.prompt}
          rows={3}
          onChange={(v) => onChange({ prompt: v })}
          placeholder="Describe the image you want."
        />
      </FormRow>
      <FormRow label="Platform" required>
        <PlatformPicker
          value={value.platform}
          onChange={(p) => onChange({ platform: p })}
        />
      </FormRow>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.use_logo ?? false}
            onCheckedChange={(v) => onChange({ use_logo: v })}
          />
          Overlay logo
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.use_mascot ?? false}
            onCheckedChange={(v) => onChange({ use_mascot: v })}
          />
          Add mascot
        </label>
      </div>
    </>
  )
}

export function MayaContentRegenForm({
  value,
  onChange,
}: {
  value: MayaContentRegenRequest
  onChange: (patch: Partial<MayaContentRegenRequest>) => void
}) {
  return (
    <>
      <FormRow label="Existing caption" required>
        <CountedTextarea
          value={value.caption}
          rows={4}
          onChange={(v) => onChange({ caption: v })}
        />
      </FormRow>
      <FormRow label="Rewrite prompt" required>
        <CountedTextarea
          value={value.prompt}
          rows={3}
          onChange={(v) => onChange({ prompt: v })}
          placeholder="e.g. Make it shorter and punchier; keep hashtags."
        />
      </FormRow>
      <FormRow label="Platform" required>
        <PlatformPicker
          value={value.platform}
          onChange={(p) => onChange({ platform: p })}
        />
      </FormRow>
    </>
  )
}
