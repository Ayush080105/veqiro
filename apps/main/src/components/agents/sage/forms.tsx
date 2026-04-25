"use client"

import * as React from "react"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { StringListInput, CountedTextarea } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import {
  sageKeywordResearchSchema,
  type SageKeywordResearchValues,
  sageGenerateBlogSchema,
  type SageGenerateBlogValues,
  sageAnalyzeContentSchema,
  type SageAnalyzeContentValues,
  sageContentBriefSchema,
  type SageContentBriefValues,
} from "@/lib/schemas/agents/sage"

// ─── Keyword research ───────────────────────────────────────────────────────

export function SageKeywordResearchForm({
  value,
  onChange,
}: {
  value: SageKeywordResearchValues
  onChange: (patch: Partial<SageKeywordResearchValues>) => void
}) {
  const form = useAgentForm({
    schema: sageKeywordResearchSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="seed_topic"
        label="Seed topic"
        required
        description="The core topic to expand around."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. AI productivity tools for founders"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="niche" label="Niche">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. early-stage SaaS"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="competitor_urls"
        label="Competitor URLs"
        description="Optional — Sage mines their content."
      >
        {({ field }) => (
          <StringListInput
            type="url"
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="https://competitor.com"
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="count" label="How many keywords?">
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={5}
            max={50}
            value={field.value ?? 20}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Generate blog ──────────────────────────────────────────────────────────

export function SageGenerateBlogForm({
  value,
  onChange,
}: {
  value: SageGenerateBlogValues
  onChange: (patch: Partial<SageGenerateBlogValues>) => void
}) {
  const form = useAgentForm({
    schema: sageGenerateBlogSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="topic" label="Topic" required>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. How founders pick an AI stack in 2026"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="target_keyword"
        label="Target keyword"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. AI stack for startups"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="secondary_keywords"
        label="Secondary keywords"
      >
        {({ field }) => (
          <StringListInput
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="Add and press Enter"
          />
        )}
      </RhfField>

      <div className="grid grid-cols-2 gap-3">
        <RhfField control={form.control} name="word_count" label="Word count">
          {({ field, invalid, id }) => (
            <Input
              id={id}
              type="number"
              min={500}
              max={5000}
              step={100}
              value={field.value ?? 2000}
              onChange={(e) => field.onChange(Number(e.target.value))}
              onBlur={field.onBlur}
              aria-invalid={invalid}
            />
          )}
        </RhfField>

        <RhfField
          control={form.control}
          name="output_format"
          label="Output format"
        >
          {({ field, id }) => (
            <Select
              value={field.value ?? "markdown"}
              onValueChange={field.onChange}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="wordpress">WordPress</SelectItem>
                <SelectItem value="wix">Wix</SelectItem>
              </SelectContent>
            </Select>
          )}
        </RhfField>
      </div>

      <Controller
        control={form.control}
        name="include_meta"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <Label variant="brand">Include meta tags</Label>
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
          </label>
        )}
      />
      <Controller
        control={form.control}
        name="include_schema_markup"
        render={({ field }) => (
          <label className="flex items-center justify-between gap-2 text-xs">
            <Label variant="brand">Include schema.org markup</Label>
            <Switch
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
            />
          </label>
        )}
      />
    </FieldGroup>
  )
}

// ─── Analyze content ────────────────────────────────────────────────────────

export function SageAnalyzeContentForm({
  value,
  onChange,
}: {
  value: SageAnalyzeContentValues
  onChange: (patch: Partial<SageAnalyzeContentValues>) => void
}) {
  const form = useAgentForm({
    schema: sageAnalyzeContentSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="content"
        label="Content"
        required
        description="Paste the article or page content."
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={8}
            onChange={field.onChange}
            placeholder="Paste your content…"
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="target_keyword"
        label="Target keyword"
        required
      >
        {({ field, invalid, id }) => (
          <Input {...field} id={id} aria-invalid={invalid} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="url"
        label="URL"
        description="If this is live, include it for competitor comparison."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            type="url"
            value={field.value ?? ""}
            placeholder="https://yoursite.com/post"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Content brief ──────────────────────────────────────────────────────────

export function SageContentBriefForm({
  value,
  onChange,
}: {
  value: SageContentBriefValues
  onChange: (patch: Partial<SageContentBriefValues>) => void
}) {
  const form = useAgentForm({
    schema: sageContentBriefSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="topic" label="Topic" required>
        {({ field, invalid, id }) => (
          <Input {...field} id={id} aria-invalid={invalid} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="target_keyword"
        label="Target keyword"
        required
      >
        {({ field, invalid, id }) => (
          <Input {...field} id={id} aria-invalid={invalid} />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="competitor_urls"
        label="Competitor URLs"
        description="Sage will pull structure and find gaps."
      >
        {({ field }) => (
          <StringListInput
            type="url"
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="https://competitor.com/article"
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}
