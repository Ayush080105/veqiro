"use client"

import { useState } from "react"
import { Controller } from "react-hook-form"
import type {
  Control,
  UseFormSetValue,
  UseFormWatch,
  FieldArrayWithId,
  FieldErrors,
} from "react-hook-form"
import {
  Building2,
  Target,
  MessageSquare,
  Palette,
  Trophy,
  ImageIcon,
  Images,
  Loader2,
  Globe,
  PlusIcon,
  XIcon,
  Sparkles,
} from "lucide-react"

import type { BrainFormValues } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Field, FieldGroup, FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { BrainCompletionBar } from "@/components/brain/BrainCompletionBar"
import { AgentReadiness } from "@/components/brain/AgentReadiness"
import { BrandImagesTab } from "@/components/brain/BrandImagesTab"
import { Card } from "@/components/ui/card"
import { CharCount } from "@/components/forms/CharCount"
import { AssetUpload } from "@/components/forms/AssetUpload"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"

// ─── Section Card + Label primitives ──────────────────────────────────────────

function VqSectionCard({
  title,
  description,
  shadow,
  children,
}: {
  title: string
  description?: string
  shadow?: string
  children: React.ReactNode
}) {
  return (
    <Card
      variant="brand"
      className="mt-4 px-5"
      style={shadow ? { boxShadow: `5px 5px 0 ${shadow}` } : undefined}
    >
      <div
        className={`font-head text-lg tracking-tight text-foreground ${
          description ? "mb-1" : "mb-4"
        }`}
      >
        {title}
      </div>
      {description && (
        <p className="mb-4 mt-0 font-body text-[13px] text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </Card>
  )
}

function VqFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  )
}

interface BrandKitSectionProps {
  control: Control<BrainFormValues>
  errors: FieldErrors<BrainFormValues>
  competitorFields: FieldArrayWithId<BrainFormValues, "competitors", "id">[]
  appendCompetitor: (value: { value: string }) => void
  removeCompetitor: (index: number) => void
  scheduleAutoSave: () => void
  setValue: UseFormSetValue<BrainFormValues>
  watch: UseFormWatch<BrainFormValues>
  scraping: boolean
  onAutoFill: () => void
  organizationId: string
}

// ─── Color Field ──────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  return (
    <Field>
      <VqFieldLabel>{label}</VqFieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-9 w-12 cursor-pointer rounded-md border border-[var(--vq-line-2)] bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="#000000"
          className="w-28 font-mono"
        />
      </div>
    </Field>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrandKitSection({
  control,
  errors,
  competitorFields,
  appendCompetitor,
  removeCompetitor,
  scheduleAutoSave,
  setValue,
  watch,
  scraping,
  onAutoFill,
  organizationId,
}: BrandKitSectionProps) {
  const [newCompetitor, setNewCompetitor] = useState("")

  const handleAddCompetitor = () => {
    const v = newCompetitor.trim()
    if (!v) return
    appendCompetitor({ value: v })
    setNewCompetitor("")
    scheduleAutoSave()
  }

  // Subscribe to form changes so live counters re-render.
  const values = watch()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Completion bar */}
      <BrainCompletionBar values={values} />

      {/* Agent readiness */}
      <AgentReadiness values={values} />

      {/* Sub-tabs */}
      <Tabs defaultValue="identity" className="min-w-0">
        <div className="-mx-1 w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)] overflow-x-auto px-1 pb-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
          <TabsList variant="line" className="min-w-max flex-nowrap">
            <TabsTrigger value="identity" className="flex-none shrink-0">
              <Building2 className="size-3.5" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="audience" className="flex-none shrink-0">
              <Target className="size-3.5" />
              Audience
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex-none shrink-0">
              <MessageSquare className="size-3.5" />
              Voice & Tone
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex-none shrink-0">
              <Palette className="size-3.5" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex-none shrink-0">
              <ImageIcon className="size-3.5" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="competitive" className="flex-none shrink-0">
              <Trophy className="size-3.5" />
              Competitive
            </TabsTrigger>
            <TabsTrigger value="site-context" className="flex-none shrink-0">
              <Sparkles className="size-3.5" />
              Site Context
            </TabsTrigger>
            <TabsTrigger value="brand-images" className="flex-none shrink-0">
              <Images className="size-3.5" />
              Brand Images
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Identity */}
        <TabsContent value="identity">
          <VqSectionCard
            title="Company Identity"
            description="Core facts about your business."
            shadow="var(--vq-red)"
          >
            <FieldGroup>
              <Field>
                <VqFieldLabel>Company Name</VqFieldLabel>
                <Controller
                  name="companyName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="Acme Inc."
                    />
                  )}
                />
                <FieldError
                  errors={
                    errors.companyName
                      ? [{ message: errors.companyName.message }]
                      : []
                  }
                />
              </Field>

              <Field>
                <VqFieldLabel>Company Description</VqFieldLabel>
                <Controller
                  name="companyDescription"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="What you make, for who. Aim for 1–2 sentences with specifics."
                        className="min-h-24"
                      />
                      <CharCount
                        value={field.value}
                        min={BRAND_KIT_MINS.companyDescription}
                        max={2000}
                        hint="Agents need this much to ground"
                      />
                    </>
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>Value Proposition</VqFieldLabel>
                <Controller
                  name="valueProposition"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="What problem you solve and what the customer gets."
                        className="min-h-20"
                      />
                      <CharCount
                        value={field.value}
                        min={BRAND_KIT_MINS.valueProposition}
                        max={500}
                        hint="One focused sentence beats three vague ones"
                      />
                    </>
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>Website URL</VqFieldLabel>
                <div className="flex items-center gap-2">
                  <Controller
                    name="websiteUrl"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="https://yourcompany.com"
                        className="flex-1"
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAutoFill}
                    disabled={scraping}
                  >
                    {scraping ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Globe className="size-3.5" />
                    )}
                    Auto-fill from URL
                  </Button>
                </div>
              </Field>

              <Field>
                <VqFieldLabel>Industry</VqFieldLabel>
                <Controller
                  name="industry"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="SaaS / FinTech / E-commerce..."
                    />
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>Location</VqFieldLabel>
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="e.g. Pune, India — leave blank if global / online"
                    />
                  )}
                />
                <p className="mt-1 font-body text-[11px] text-muted-foreground">
                  Scout uses this to find local competitors instead of defaulting to US companies.
                </p>
              </Field>
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Audience */}
        <TabsContent value="audience">
          <VqSectionCard
            title="Target Audience"
            description="Who your agents are writing and selling to."
            shadow="var(--vq-pink)"
          >
            <FieldGroup>
              <Field>
                <VqFieldLabel>Ideal Customer</VqFieldLabel>
                <Controller
                  name="targetAudience"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="Job titles, company sizes, motivations, where they hang out…"
                        className="min-h-32"
                      />
                      <CharCount
                        value={field.value}
                        min={BRAND_KIT_MINS.targetAudience}
                        max={1000}
                        hint="Be specific — generic audiences make generic content"
                      />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Voice & Tone */}
        <TabsContent value="voice">
          <VqSectionCard
            title="Brand Voice & Tone"
            description="How your brand communicates across channels."
            shadow="var(--vq-violet)"
          >
            <FieldGroup>
              <Field>
                <VqFieldLabel>Brand Voice Preset</VqFieldLabel>
                <Controller
                  name="brandVoice"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        scheduleAutoSave()
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional">Professional</SelectItem>
                        <SelectItem value="Casual">Casual</SelectItem>
                        <SelectItem value="Bold">Bold</SelectItem>
                        <SelectItem value="Playful">Playful</SelectItem>
                        <SelectItem value="Warm">Warm</SelectItem>
                        <SelectItem value="Witty">Witty</SelectItem>
                        <SelectItem value="Rebellious">Rebellious</SelectItem>
                        <SelectItem value="Minimal">Minimal</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>Twitter / X Tone</VqFieldLabel>
                <Controller
                  name="platformTones.twitter"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="Punchy and direct"
                    />
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>LinkedIn Tone</VqFieldLabel>
                <Controller
                  name="platformTones.linkedin"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="Professional and insightful"
                    />
                  )}
                />
              </Field>

              <Field>
                <VqFieldLabel>Instagram Tone</VqFieldLabel>
                <Controller
                  name="platformTones.instagram"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        scheduleAutoSave()
                      }}
                      placeholder="Visual and hashtag-heavy"
                    />
                  )}
                />
              </Field>
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Visual */}
        <TabsContent value="visual">
          <VqSectionCard
            title="Visual Identity"
            description="Brand colours used in generated assets."
            shadow="var(--vq-blue)"
          >
            <FieldGroup>
              <Controller
                name="brandColors.primary"
                control={control}
                render={({ field }) => (
                  <ColorField
                    label="Primary"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={scheduleAutoSave}
                  />
                )}
              />
              <Controller
                name="brandColors.secondary"
                control={control}
                render={({ field }) => (
                  <ColorField
                    label="Secondary"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={scheduleAutoSave}
                  />
                )}
              />
              <Controller
                name="brandColors.accent"
                control={control}
                render={({ field }) => (
                  <ColorField
                    label="Accent"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={scheduleAutoSave}
                  />
                )}
              />
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Assets — logo, mascot & letterhead uploads */}
        <TabsContent value="assets">
          <VqSectionCard
            title="Logo, Mascot & Letterhead"
            description="Maya pulls logo and mascot into generated images. Letterhead is stamped on Lex document exports. PNG, JPEG, WebP, or SVG; under 5MB (10MB for letterhead)."
            shadow="var(--vq-green)"
          >
            <FieldGroup>
              <Field>
                <Controller
                  name="logoUrl"
                  control={control}
                  render={({ field }) => (
                    <AssetUpload
                      kind="logo"
                      label="Logo"
                      hint="Square or wide PNG/SVG works best"
                      value={field.value}
                      onChange={({ url, key }) => {
                        setValue("logoUrl", url, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        setValue("logoKey", key, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        scheduleAutoSave()
                      }}
                      disabled={!organizationId}
                    />
                  )}
                />
              </Field>

              <Field>
                <Controller
                  name="mascotUrl"
                  control={control}
                  render={({ field }) => (
                    <AssetUpload
                      kind="mascot"
                      label="Mascot (optional)"
                      hint="A character / illustration that lives in your brand"
                      value={field.value}
                      onChange={({ url, key }) => {
                        setValue("mascotUrl", url, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        setValue("mascotKey", key, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        scheduleAutoSave()
                      }}
                      disabled={!organizationId}
                    />
                  )}
                />
              </Field>

              <Field>
                <Controller
                  name="letterheadUrl"
                  control={control}
                  render={({ field }) => (
                    <AssetUpload
                      kind="letterhead"
                      label="Letterhead (optional)"
                      hint="Full-width letterhead image — appears at the top of every Lex document export"
                      value={field.value}
                      onChange={({ url, key }) => {
                        setValue("letterheadUrl", url, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        setValue("letterheadKey", key, {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                        scheduleAutoSave()
                      }}
                      disabled={!organizationId}
                    />
                  )}
                />
              </Field>
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Competitive */}
        <TabsContent value="competitive">
          <VqSectionCard
            title="Competitors & Differentiators"
            description="Help your agents position you correctly."
            shadow="var(--vq-yellow)"
          >
            <FieldGroup>
              <Field>
                <VqFieldLabel>Competitors</VqFieldLabel>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {competitorFields.map((f, i) => (
                    <Badge key={f.id} variant="outline" className="gap-1 pr-1">
                      <Controller
                        name={`competitors.${i}.value`}
                        control={control}
                        render={({ field }) => <span>{field.value}</span>}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          removeCompetitor(i)
                          scheduleAutoSave()
                        }}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newCompetitor}
                    onChange={(e) => setNewCompetitor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddCompetitor()
                      }
                    }}
                    placeholder="Type a competitor name and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCompetitor}
                  >
                    <PlusIcon className="size-3.5" />
                    Add
                  </Button>
                </div>
              </Field>

              <Field>
                <VqFieldLabel>Key Differentiators</VqFieldLabel>
                <Controller
                  name="keyDifferentiators"
                  control={control}
                  render={({ field }) => (
                    <>
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="Why you, not them. Bullet-style works."
                        className="min-h-32"
                      />
                      <CharCount
                        value={field.value}
                        min={BRAND_KIT_MINS.keyDifferentiators}
                        max={2000}
                        hint="Concrete claims beat adjectives"
                      />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </VqSectionCard>
        </TabsContent>

        {/* Site Context — output of the Jina-Reader crawl. Feeds straight into
            agent system prompts as "Site Context" so they ground in the
            user's actual website language. Editable; user can rewrite or
            re-crawl on demand. */}
        <TabsContent value="site-context">
          <VqSectionCard
            title="Site Context"
            description="What we pulled from your site. Agents read this to sound like you."
            shadow="var(--vq-cream,#FFF9ED)"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Crawled summary (used in prompts)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAutoFill}
                disabled={scraping}
              >
                {scraping ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Globe className="size-3.5" />
                )}
                {scraping ? "Crawling…" : "Re-crawl now"}
              </Button>
            </div>
            <Field>
              <Controller
                name="crawledSummary"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    onBlur={() => {
                      field.onBlur()
                      scheduleAutoSave()
                    }}
                    placeholder="Click Re-crawl to pull a fresh summary from your site, or paste one here."
                    className="min-h-32"
                  />
                )}
              />
            </Field>

            <details className="mt-4 rounded-md border border-[var(--vq-line-2)] bg-background/60 p-3">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                Raw crawled content (read-only)
              </summary>
              <Controller
                name="crawledContent"
                control={control}
                render={({ field }) => (
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {field.value || "No content crawled yet."}
                  </pre>
                )}
              />
            </details>
          </VqSectionCard>
        </TabsContent>

        {/* Brand Images — persistent reference images for Maya */}
        <TabsContent value="brand-images">
          <BrandImagesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
