"use client"

import * as React from "react"
import { Loader2, Globe, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { RhfField } from "@/components/forms/RhfField"
import { CharCount } from "@/components/forms/CharCount"
import { BRAND_KIT_MINS } from "@/lib/schemas/brand-kit"
import { useScrapeBrandKit } from "@/lib/api/brain"

import { StepShell } from "../_lib/step-shell"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step2")!

export default function Step2Identity() {
  const { control, getValues, setValue, watch } = useOnboardingForm()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const scrape = useScrapeBrandKit(organizationId)

  const websiteUrl = watch("websiteUrl")
  const crawledSummary = watch("crawledSummary")

  const canCrawl =
    !!organizationId &&
    !!websiteUrl &&
    /^https?:\/\//u.test(websiteUrl) &&
    !scrape.isPending

  const handleCrawl = async () => {
    const url = (getValues("websiteUrl") || "").trim()
    if (!url || !/^https?:\/\//u.test(url)) {
      toast.error("Enter a valid http(s) URL first.")
      return
    }
    try {
      const result = await scrape.mutateAsync(url)
      setValue("crawledSummary", result.summary, {
        shouldDirty: true,
        shouldTouch: true,
      })
      setValue("crawledContent", result.content, {
        shouldDirty: true,
        shouldTouch: true,
      })
      toast.success(
        result.source === "jina"
          ? "Pulled context from your site — feel free to trim it."
          : "Pulled what we could from your site (basic mode).",
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not reach that URL.",
      )
    }
  }

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <div className="flex flex-col gap-5">
        <RhfField control={control} name="companyName" label="Company name">
          {({ field, invalid, id }) => (
            <Input
              {...field}
              id={id}
              variant="brand"
              placeholder="e.g. Lumen Beverage Co."
              aria-invalid={invalid}
            />
          )}
        </RhfField>

        <RhfField
          control={control}
          name="companyDescription"
          label="Company description"
          description="What you make, for who. Aim for 1–2 specific sentences."
        >
          {({ field, invalid, id }) => (
            <>
              <Textarea
                {...field}
                id={id}
                variant="brand"
                rows={4}
                placeholder="We make adaptogenic sparkling drinks for people who quit coffee but still want to vibrate."
                aria-invalid={invalid}
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.companyDescription}
                max={2000}
                hint="Concrete > generic"
              />
            </>
          )}
        </RhfField>

        <RhfField
          control={control}
          name="valueProposition"
          label="Value proposition"
          description="What problem does this solve, and what does the customer get?"
        >
          {({ field, invalid, id }) => (
            <>
              <Textarea
                {...field}
                id={id}
                variant="brand"
                rows={3}
                placeholder="Founders ship branded social posts in minutes — no agency, no copywriter, no blank-page anxiety."
                aria-invalid={invalid}
              />
              <CharCount
                value={field.value}
                min={BRAND_KIT_MINS.valueProposition}
                max={500}
                hint="One focused sentence beats three vague ones"
              />
            </>
          )}
        </RhfField>

        <RhfField
          control={control}
          name="websiteUrl"
          label="Website (optional)"
          description="If you have one, hit Auto-fill — we'll pull context for your crew."
        >
          {({ field, invalid, id }) => (
            <div className="flex items-stretch gap-2">
              <Input
                {...field}
                id={id}
                variant="brand"
                placeholder="https://lumen.co"
                aria-invalid={invalid}
                className="flex-1"
              />
              <Button
                type="button"
                variant="brand-ghost"
                size="brand-sm"
                onClick={handleCrawl}
                disabled={!canCrawl}
                aria-label="Auto-fill from URL"
              >
                {scrape.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Globe className="size-3.5" />
                )}
                {scrape.isPending ? "Crawling…" : "Auto-fill"}
              </Button>
            </div>
          )}
        </RhfField>

        {/* Site context — appears once a crawl has run (manual or background).
            User can edit before continuing; this is what AI agents will read. */}
        {(crawledSummary || scrape.isPending) && (
          <div className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-[color:var(--vq-cream,#FFF9ED)] p-4 shadow-[var(--vq-shadow-sm)]">
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
              <Sparkles className="size-3.5" />
              Site context
              <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-muted-foreground">
                Pulled from your site — agents will read this
              </span>
            </div>
            <RhfField
              control={control}
              name="crawledSummary"
              label=""
              description="Trim or rewrite to highlight what your crew should know."
            >
              {({ field, id }) => (
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  variant="brand"
                  rows={6}
                  placeholder="Crawled site summary will appear here…"
                />
              )}
            </RhfField>
          </div>
        )}
      </div>
    </StepShell>
  )
}
