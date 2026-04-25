"use client"

import * as React from "react"
import { Controller } from "react-hook-form"
import { Heart } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { FieldGroup } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { StringListInput, CountedTextarea } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { useSavedKeywords } from "@/lib/api/sage"
import { cn } from "@/lib/utils"
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

  const { data: savedKeywords = [] } = useSavedKeywords()
  const [kwPickerOpen, setKwPickerOpen] = React.useState(false)

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
          <div className="flex gap-1.5">
            <Input
              {...field}
              id={id}
              placeholder="e.g. AI stack for startups"
              aria-invalid={invalid}
              className="flex-1"
            />
            {savedKeywords.length > 0 && (
              <Popover open={kwPickerOpen} onOpenChange={setKwPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Pick from saved keywords"
                  >
                    <Heart className="size-3.5 fill-destructive text-destructive" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Saved keywords
                  </p>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {savedKeywords.map((kw) => (
                      <button
                        key={kw.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted",
                          field.value === kw.keyword && "bg-muted"
                        )}
                        onClick={() => {
                          field.onChange(kw.keyword)
                          setKwPickerOpen(false)
                        }}
                      >
                        <span className="truncate text-xs">{kw.keyword}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="outline" className={cn(
                            "text-[9px]",
                            kw.estimatedDifficulty >= 70 ? "border-destructive/50 text-destructive"
                            : kw.estimatedDifficulty >= 40 ? "border-chart-3/50 text-chart-3"
                            : "border-chart-2/50 text-chart-2"
                          )}>
                            {kw.estimatedDifficulty}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
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
