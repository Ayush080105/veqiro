"use client"

import { useState } from "react"
import { Controller } from "react-hook-form"
import type { Control, UseFormGetValues, FieldArrayWithId } from "react-hook-form"
import {
  Building2,
  Target,
  MessageSquare,
  Palette,
  Trophy,
  Loader2,
  Globe,
  PlusIcon,
  XIcon,
} from "lucide-react"

import type { BrainFormValues } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
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

interface BrandKitSectionProps {
  control: Control<BrainFormValues>
  errors: Record<string, any>
  competitorFields: FieldArrayWithId<BrainFormValues, "competitors", "id">[]
  appendCompetitor: (value: { value: string }) => void
  removeCompetitor: (index: number) => void
  scheduleAutoSave: () => void
  getValues: UseFormGetValues<BrainFormValues>
  scraping: boolean
  onAutoFill: () => void
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
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-8 w-10 cursor-pointer rounded-none border border-input bg-transparent p-0.5"
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
  getValues,
  scraping,
  onAutoFill,
}: BrandKitSectionProps) {
  const [newCompetitor, setNewCompetitor] = useState("")

  const handleAddCompetitor = () => {
    const v = newCompetitor.trim()
    if (!v) return
    appendCompetitor({ value: v })
    setNewCompetitor("")
    scheduleAutoSave()
  }

  const values = getValues()

  return (
    <div className="flex flex-col gap-4">
      {/* Completion bar */}
      <BrainCompletionBar values={values} />

      {/* Agent readiness */}
      <AgentReadiness values={values} />

      {/* Sub-tabs */}
      <Tabs defaultValue="identity">
        <TabsList variant="line">
          <TabsTrigger value="identity">
            <Building2 className="size-3.5" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="audience">
            <Target className="size-3.5" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="voice">
            <MessageSquare className="size-3.5" />
            Voice & Tone
          </TabsTrigger>
          <TabsTrigger value="visual">
            <Palette className="size-3.5" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="competitive">
            <Trophy className="size-3.5" />
            Competitive
          </TabsTrigger>
        </TabsList>

        {/* Identity */}
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>Company Identity</CardTitle>
              <CardDescription>Core facts about your business.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Company Name</FieldLabel>
                  <Controller
                    name="company_name"
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
                      errors.company_name
                        ? [{ message: errors.company_name.message }]
                        : []
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>Company Description</FieldLabel>
                  <Controller
                    name="company_description"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="What does your company do?"
                      />
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>Website URL</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Controller
                      name="website_url"
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
                  <FieldLabel>Industry</FieldLabel>
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
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audience */}
        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>
                Who your agents are writing and selling to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Ideal Customer</FieldLabel>
                  <Controller
                    name="target_audience"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="Who is your ideal customer? Job titles, company sizes, challenges..."
                        className="min-h-24"
                      />
                    )}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice & Tone */}
        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice &amp; Tone</CardTitle>
              <CardDescription>
                How your brand communicates across channels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Brand Voice Preset</FieldLabel>
                  <Controller
                    name="brand_voice"
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
                          <SelectItem value="Professional">
                            Professional
                          </SelectItem>
                          <SelectItem value="Casual">Casual</SelectItem>
                          <SelectItem value="Bold">Bold</SelectItem>
                          <SelectItem value="Minimal">Minimal</SelectItem>
                          <SelectItem value="Technical">Technical</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>Twitter / X Tone</FieldLabel>
                  <Controller
                    name="platform_tones.twitter"
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
                  <FieldLabel>LinkedIn Tone</FieldLabel>
                  <Controller
                    name="platform_tones.linkedin"
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
                  <FieldLabel>Instagram Tone</FieldLabel>
                  <Controller
                    name="platform_tones.instagram"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visual */}
        <TabsContent value="visual">
          <Card>
            <CardHeader>
              <CardTitle>Visual Identity</CardTitle>
              <CardDescription>
                Brand colours used in generated assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Controller
                  name="brand_colors.primary"
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
                  name="brand_colors.secondary"
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
                  name="brand_colors.accent"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitive */}
        <TabsContent value="competitive">
          <Card>
            <CardHeader>
              <CardTitle>Competitors &amp; Differentiators</CardTitle>
              <CardDescription>
                Help your agents position you correctly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Competitors</FieldLabel>
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
                  <FieldLabel>Key Differentiators</FieldLabel>
                  <Controller
                    name="key_differentiators"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        onBlur={() => {
                          field.onBlur()
                          scheduleAutoSave()
                        }}
                        placeholder="What makes you stand out from the competition?"
                        className="min-h-24"
                      />
                    )}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
