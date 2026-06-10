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
  sageGenerateBlogIdeasSchema,
  type SageGenerateBlogIdeasValues,
  sagePageSeoAuditSchema,
  type SagePageSeoAuditValues,
  sageSiteAuditSchema,
  type SageSiteAuditValues,
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
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Pick from saved keywords"
                    >
                      <Heart className="size-3.5 fill-destructive text-destructive" />
                    </Button>
                  }
                />
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

// ─── Generate blog ideas ────────────────────────────────────────────────────

export function SageGenerateBlogIdeasForm({
  value,
  onChange,
}: {
  value: SageGenerateBlogIdeasValues
  onChange: (patch: Partial<SageGenerateBlogIdeasValues>) => void
}) {
  const form = useAgentForm({
    schema: sageGenerateBlogIdeasSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="count"
        label="Number of ideas"
        description="Sage reads your brandkit and generates trending blog topics tailored to your company."
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={20}
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

// ─── Page SEO Audit ─────────────────────────────────────────────────────────

export function SagePageSeoAuditForm({
  value,
  onChange,
}: {
  value: SagePageSeoAuditValues
  onChange: (patch: Partial<SagePageSeoAuditValues>) => void
}) {
  const form = useAgentForm({
    schema: sagePageSeoAuditSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="url"
        label="Page URL"
        required
        description="The full URL of the page you want to audit."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            type="url"
            placeholder="https://yoursite.com/blog/post"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="target_keyword"
        label="Target keyword"
        required
        description="The primary keyword this page should rank for."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. AI tools for founders"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Site Audit (two-step: discover → pick pages) ───────────────────────────

export function SageSiteAuditForm({
  value,
  onChange,
}: {
  value: SageSiteAuditValues
  onChange: (patch: Partial<SageSiteAuditValues>) => void
}) {
  const [step, setStep] = React.useState<"input" | "discovering" | "select">("input")
  const [pages, setPages] = React.useState<Array<{ url: string; title: string; status_code: number }>>([])
  const [error, setError] = React.useState<string | null>(null)
  const [domain, setDomain] = React.useState(value.domain ?? "")
  const [keyword, setKeyword] = React.useState(value.target_keyword ?? "")
  const [selected, setSelected] = React.useState<Set<string>>(new Set(value.urls ?? []))

  const handleDiscover = async () => {
    if (!domain.trim()) return
    setError(null)
    setStep("discovering")
    try {
      const { discoverPages } = await import("@/lib/api/sage")
      const result = await discoverPages(domain.trim())
      setPages(result.pages)
      setStep("select")
    } catch {
      setError("Could not fetch pages. Check the domain and try again.")
      setStep("input")
    }
  }

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else if (next.size < 5) {
        next.add(url)
      }
      return next
    })
  }

  // Sync selection up whenever it changes
  React.useEffect(() => {
    onChange({ domain, urls: Array.from(selected), target_keyword: keyword })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, keyword, domain])

  if (step === "input" || step === "discovering") {
    return (
      <FieldGroup>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Domain <span className="text-destructive">*</span></label>
          <Input
            value={domain}
            placeholder="yoursite.com"
            onChange={(e) => {
              let v = e.target.value
              if (v.startsWith("https://")) v = v.slice(8)
              if (v.startsWith("http://")) v = v.slice(7)
              setDomain(v)
            }}
            onKeyDown={(e) => e.key === "Enter" && keyword.trim() && handleDiscover()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Target keyword <span className="text-destructive">*</span></label>
          <Input
            value={keyword}
            placeholder="e.g. AI tools for startups"
            onChange={(e) => setKeyword(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">Applied to all pages in this audit.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!domain.trim() || !keyword.trim() || step === "discovering"}
          onClick={handleDiscover}
        >
          {step === "discovering" ? "Discovering pages…" : "Find Pages →"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </FieldGroup>
    )
  }

  // step === "select"
  return (
    <FieldGroup>
      {/* Summary of what was entered */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[9px]">{domain}</Badge>
        <Badge variant="outline" className="text-[9px]">keyword: {keyword}</Badge>
      </div>

      {/* Page picker */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Select pages to audit <span className="text-destructive">*</span></label>
          <span className="text-[10px] text-muted-foreground">{selected.size}/5 selected</span>
        </div>
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded border border-border/60 p-1">
          {pages.map((page) => {
            const isSelected = selected.has(page.url)
            const isDisabled = !isSelected && selected.size >= 5
            const status = page.status_code
            return (
              <button
                key={page.url}
                type="button"
                disabled={isDisabled}
                onClick={() => toggle(page.url)}
                className={cn(
                  "flex items-start gap-2 rounded px-2 py-1.5 text-left transition-colors",
                  isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted",
                  isDisabled && "cursor-not-allowed opacity-40",
                )}
              >
                <div className={cn(
                  "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border",
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                )}>
                  {isSelected && <span className="text-[8px] font-bold">✓</span>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[11px] font-medium">
                    {page.title || page.url.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="truncate text-[9px] text-muted-foreground">{page.url}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[8px]",
                    status === 200 ? "border-chart-2/40 text-chart-2" : "border-destructive/40 text-destructive",
                  )}
                >
                  {status}
                </Badge>
              </button>
            )
          })}
        </div>
        {pages.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No pages found in sitemap.</p>
        )}
      </div>

      <Button type="button" variant="ghost" size="xs" onClick={() => setStep("input")}>
        ← Change domain
      </Button>
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
