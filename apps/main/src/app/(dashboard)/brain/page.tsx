"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { getBrandKit, saveBrandKit, scrapeBrandKit } from "@/lib/api/brain"
import type { BrandKit } from "@/lib/types"

import { Skeleton } from "@/components/ui/skeleton"
import { BrandKitSection } from "@/components/brain/BrandKitSection"
import { Button as VqButton, PageHeader, FONT } from "@/components/veqiro/shared"

// ─── Schema ────────────────────────────────────────────────────────────────────

const brainSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_description: z.string(),
  website_url: z.string(),
  industry: z.string(),
  target_audience: z.string(),
  brand_voice: z.string(),
  platform_tones: z.object({
    twitter: z.string(),
    linkedin: z.string(),
    instagram: z.string(),
  }),
  brand_colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  competitors: z.array(z.object({ value: z.string() })),
  key_differentiators: z.string(),
})

type BrainFormValues = z.infer<typeof brainSchema>

// ─── Default Values ────────────────────────────────────────────────────────────

const DEFAULT_VALUES: BrainFormValues = {
  company_name: "",
  company_description: "",
  website_url: "",
  industry: "",
  target_audience: "",
  brand_voice: "Professional",
  platform_tones: { twitter: "", linkedin: "", instagram: "" },
  brand_colors: { primary: "#000000", secondary: "#ffffff", accent: "#888888" },
  competitors: [],
  key_differentiators: "",
}

const LOCAL_KEY = "veqiro.brandKitLocal"

function brandKitToForm(kit: BrandKit): BrainFormValues {
  return {
    company_name: kit.company_name ?? "",
    company_description: kit.company_description ?? "",
    website_url: kit.website_url ?? "",
    industry: kit.industry ?? "",
    target_audience: kit.target_audience ?? "",
    brand_voice: kit.brand_voice ?? "Professional",
    platform_tones: kit.platform_tones ?? { twitter: "", linkedin: "", instagram: "" },
    brand_colors: kit.brand_colors ?? {
      primary: "#000000",
      secondary: "#ffffff",
      accent: "#888888",
    },
    competitors: (kit.competitors ?? []).map((c) => ({ value: c })),
    key_differentiators: kit.key_differentiators ?? "",
  }
}

function formToBrandKit(values: BrainFormValues): Partial<BrandKit> {
  return {
    ...values,
    competitors: values.competitors.map((c) => c.value).filter(Boolean),
  }
}

function BrainSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrainPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [backendUnavailable, setBackendUnavailable] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<BrainFormValues>({
    resolver: zodResolver(brainSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const { fields: competitorFields, append, remove } = useFieldArray({
    control,
    name: "competitors",
  })

  // Load brand kit on mount: backend first, then localStorage fallback.
  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    setLoading(true)

    getBrandKit(organizationId)
      .then((kit) => {
        if (cancelled) return
        if (kit) {
          reset(brandKitToForm(kit))
          setBackendUnavailable(false)
        } else {
          setBackendUnavailable(true)
          try {
            const local = localStorage.getItem(`${LOCAL_KEY}.${organizationId}`)
            if (local) {
              const parsed = JSON.parse(local) as BrandKit
              reset(brandKitToForm(parsed))
            }
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        setBackendUnavailable(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, reset])

  const persistLocally = (values: BrainFormValues) => {
    if (!organizationId) return
    try {
      localStorage.setItem(
        `${LOCAL_KEY}.${organizationId}`,
        JSON.stringify(formToBrandKit(values))
      )
    } catch {
      /* ignore */
    }
  }

  const scheduleAutoSave = () => {
    setHasPending(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const values = getValues()
      persistLocally(values)
      try {
        const result = await saveBrandKit(organizationId, formToBrandKit(values))
        if (result.ok) {
          setHasPending(false)
          setBackendUnavailable(false)
        } else if (result.unavailable) {
          setBackendUnavailable(true)
          setHasPending(false)
        } else {
          toast.error("Auto-save failed")
        }
      } catch {
        toast.error("Auto-save failed")
      }
    }, 800)
  }

  const onSave = async (values: BrainFormValues) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaving(true)
    persistLocally(values)
    try {
      const result = await saveBrandKit(organizationId, formToBrandKit(values))
      if (result.ok) {
        setHasPending(false)
        setBackendUnavailable(false)
        toast.success("Brand kit saved")
      } else if (result.unavailable) {
        setBackendUnavailable(true)
        toast.info("Backend offline — your changes are saved locally")
      } else {
        toast.error("Failed to save brand kit")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAutoFill = async () => {
    const url = getValues("website_url")
    if (!url) {
      toast.error("Enter a website URL first")
      return
    }
    setScraping(true)
    try {
      const scraped = await scrapeBrandKit(url, organizationId)
      const current = getValues()
      reset({
        ...current,
        ...Object.fromEntries(
          Object.entries(scraped).filter(
            ([, v]) => v !== undefined && v !== null && v !== ""
          )
        ),
        brand_colors: scraped.brand_colors ?? current.brand_colors,
        platform_tones: scraped.platform_tones ?? current.platform_tones,
        competitors: scraped.competitors
          ? scraped.competitors.map((c) => ({ value: c }))
          : current.competitors,
      } as BrainFormValues)
      toast.success("Auto-filled from URL")
      scheduleAutoSave()
    } catch {
      toast.error("Failed to scrape URL")
    } finally {
      setScraping(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl pb-24">
        <div className="mb-6">
          <PageHeader
            kicker="your crew's memory"
            title="brain"
            subtitle="The single source of truth every agent reads before they speak."
          />
        </div>
        <BrainSkeleton />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="mx-auto max-w-4xl pb-24">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          kicker="your crew's memory"
          title="brain"
          subtitle="The single source of truth every agent reads before they speak."
        />
      </div>

      {/* Backend unavailable notice */}
      {backendUnavailable && (
        <div
          style={{
            marginBottom: 16,
            background: "var(--vq-yellow)",
            border: "2.5px solid #111",
            borderRadius: 10,
            boxShadow: "3px 3px 0 #111",
            padding: "10px 14px",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1,
            color: "#111",
          }}
        >
          {"// Brand Kit storage isn't connected yet — your changes save locally and will sync when the backend ships."}
        </div>
      )}

      <BrandKitSection
        control={control}
        errors={errors}
        competitorFields={competitorFields}
        appendCompetitor={append}
        removeCompetitor={remove}
        scheduleAutoSave={scheduleAutoSave}
        getValues={getValues}
        scraping={scraping}
        onAutoFill={handleAutoFill}
      />

      {/* Sticky Save Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          borderTop: "3px solid #111",
          background: "#EFE7D6",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        {!hasPending && !saving && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#555",
            }}
          >
            changes auto-saved
          </span>
        )}
        {hasPending && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#7A5A00",
            }}
          >
            unsaved changes...
          </span>
        )}
        <VqButton type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving..." : "Save brain"}
        </VqButton>
      </div>
    </form>
  )
}
