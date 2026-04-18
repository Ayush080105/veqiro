"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormRow,
  StringListInput,
  CountedTextarea,
} from "@/components/chat/ActionForm/fields"
import type {
  SageKeywordResearchRequest,
  SageGenerateBlogRequest,
  SageAnalyzeContentRequest,
  SageContentBriefRequest,
} from "@/lib/types/agents"

// ─── Keyword research ────────────────────────────────────────────────────────

export function SageKeywordResearchForm({
  value,
  onChange,
}: {
  value: SageKeywordResearchRequest
  onChange: (patch: Partial<SageKeywordResearchRequest>) => void
}) {
  return (
    <>
      <FormRow label="Seed topic" required hint="The core topic to expand around.">
        <Input
          value={value.seed_topic}
          placeholder="e.g. AI productivity tools for founders"
          onChange={(e) => onChange({ seed_topic: e.target.value })}
        />
      </FormRow>
      <FormRow label="Niche">
        <Input
          value={value.niche ?? ""}
          placeholder="e.g. early-stage SaaS"
          onChange={(e) => onChange({ niche: e.target.value })}
        />
      </FormRow>
      <FormRow label="Competitor URLs" hint="Optional — Sage mines their content.">
        <StringListInput
          type="url"
          value={value.competitor_urls ?? []}
          onChange={(next) => onChange({ competitor_urls: next })}
          placeholder="https://competitor.com"
        />
      </FormRow>
      <FormRow label="How many keywords?">
        <Input
          type="number"
          min={5}
          max={50}
          value={value.count ?? 20}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
        />
      </FormRow>
    </>
  )
}

// ─── Generate blog ───────────────────────────────────────────────────────────

export function SageGenerateBlogForm({
  value,
  onChange,
}: {
  value: SageGenerateBlogRequest
  onChange: (patch: Partial<SageGenerateBlogRequest>) => void
}) {
  return (
    <>
      <FormRow label="Topic" required>
        <Input
          value={value.topic}
          placeholder="e.g. How founders pick an AI stack in 2026"
          onChange={(e) => onChange({ topic: e.target.value })}
        />
      </FormRow>
      <FormRow label="Target keyword" required>
        <Input
          value={value.target_keyword}
          placeholder="e.g. AI stack for startups"
          onChange={(e) => onChange({ target_keyword: e.target.value })}
        />
      </FormRow>
      <FormRow label="Secondary keywords">
        <StringListInput
          value={value.secondary_keywords ?? []}
          onChange={(next) => onChange({ secondary_keywords: next })}
          placeholder="Add and press Enter"
        />
      </FormRow>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Word count">
          <Input
            type="number"
            min={500}
            max={5000}
            step={100}
            value={value.word_count ?? 2000}
            onChange={(e) => onChange({ word_count: Number(e.target.value) })}
          />
        </FormRow>
        <FormRow label="Output format">
          <Select
            value={value.output_format ?? "markdown"}
            onValueChange={(v) =>
              onChange({ output_format: v as SageGenerateBlogRequest["output_format"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="wordpress">WordPress</SelectItem>
              <SelectItem value="wix">Wix</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </div>
      <FormRow label="Include meta tags">
        <Switch
          checked={value.include_meta ?? true}
          onCheckedChange={(v) => onChange({ include_meta: v })}
        />
      </FormRow>
      <FormRow label="Include schema.org markup">
        <Switch
          checked={value.include_schema_markup ?? false}
          onCheckedChange={(v) => onChange({ include_schema_markup: v })}
        />
      </FormRow>
    </>
  )
}

// ─── Analyze content ─────────────────────────────────────────────────────────

export function SageAnalyzeContentForm({
  value,
  onChange,
}: {
  value: SageAnalyzeContentRequest
  onChange: (patch: Partial<SageAnalyzeContentRequest>) => void
}) {
  return (
    <>
      <FormRow label="Content" required hint="Paste the article or page content.">
        <CountedTextarea
          value={value.content}
          rows={8}
          onChange={(v) => onChange({ content: v })}
          placeholder="Paste your content…"
        />
      </FormRow>
      <FormRow label="Target keyword" required>
        <Input
          value={value.target_keyword}
          onChange={(e) => onChange({ target_keyword: e.target.value })}
        />
      </FormRow>
      <FormRow label="URL" hint="If this is live, include it for competitor comparison.">
        <Input
          type="url"
          value={value.url ?? ""}
          placeholder="https://yoursite.com/post"
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </FormRow>
    </>
  )
}

// ─── Content brief ───────────────────────────────────────────────────────────

export function SageContentBriefForm({
  value,
  onChange,
}: {
  value: SageContentBriefRequest
  onChange: (patch: Partial<SageContentBriefRequest>) => void
}) {
  return (
    <>
      <FormRow label="Topic" required>
        <Input
          value={value.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
        />
      </FormRow>
      <FormRow label="Target keyword" required>
        <Input
          value={value.target_keyword}
          onChange={(e) => onChange({ target_keyword: e.target.value })}
        />
      </FormRow>
      <FormRow label="Competitor URLs" hint="Sage will pull structure and find gaps.">
        <StringListInput
          type="url"
          value={value.competitor_urls ?? []}
          onChange={(next) => onChange({ competitor_urls: next })}
          placeholder="https://competitor.com/article"
        />
      </FormRow>
    </>
  )
}
