"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { useBrandKit, useSaveBrandKit, useScrapeBrandKit } from "@/lib/api/brain"
import type { BrandKit } from "@/lib/types"

import { Skeleton } from "@/components/ui/skeleton"
import { BrandKitSection } from "@/components/brain/BrandKitSection"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { brainAutosaveSchema, type BrainAutosaveValues } from "@/lib/schemas/brand-kit"

// Permissive auto-save schema — strict minimums live in finalizeBrainSchema and
// are enforced by /finalize.
type BrainFormValues = BrainAutosaveValues

// ─── Default Values ────────────────────────────────────────────────────────────

const DEFAULT_VALUES: BrainFormValues = {
  companyName: "",
  companyDescription: "",
  valueProposition: "",
  websiteUrl: "",
  industry: "",
  location: "",
  targetAudience: "",
  brandVoice: "Professional",
  platformTones: { twitter: "", linkedin: "", instagram: "" },
  brandColors: { primary: "#000000", secondary: "#ffffff", accent: "#888888" },
  competitors: [],
  keyDifferentiators: "",
  logoUrl: null,
  logoKey: null,
  mascotUrl: null,
  mascotKey: null,
  letterheadUrl: null,
  letterheadKey: null,
  crawledContent: null,
  crawledSummary: null,
}

const LOCAL_KEY = "veqiro.brandKitLocal"

function brandKitToForm(kit: BrandKit): BrainFormValues {
  return {
    companyName: kit.companyName ?? "",
    companyDescription: kit.companyDescription ?? "",
    valueProposition: kit.valueProposition ?? "",
    websiteUrl: kit.websiteUrl ?? "",
    industry: kit.industry ?? "",
    location: kit.location ?? "",
    targetAudience: kit.targetAudience ?? "",
    brandVoice: kit.brandVoice ?? "Professional",
    platformTones: kit.platformTones ?? { twitter: "", linkedin: "", instagram: "" },
    brandColors: kit.brandColors ?? {
      primary: "#000000",
      secondary: "#ffffff",
      accent: "#888888",
    },
    competitors: (kit.competitors ?? []).map((c) => ({ value: c })),
    keyDifferentiators: kit.keyDifferentiators ?? "",
    logoUrl: kit.logoUrl ?? null,
    logoKey: kit.logoKey ?? null,
    mascotUrl: kit.mascotUrl ?? null,
    mascotKey: kit.mascotKey ?? null,
    letterheadUrl: kit.letterheadUrl ?? null,
    letterheadKey: kit.letterheadKey ?? null,
    crawledContent: kit.crawledContent ?? null,
    crawledSummary: kit.crawledSummary ?? null,
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

function formatLastSaved(ts: number | null): string {
  if (!ts) return ""
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function currentTimestamp(): number {
  return Date.now()
}

export default function BrainPage() {
  const router = useRouter()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const { data: kit, isPending: kitPending, isError: kitError } = useBrandKit(organizationId)
  const saveMutation = useSaveBrandKit(organizationId)
  const scrapeMutation = useScrapeBrandKit(organizationId)
  const loading = !organizationId || kitPending

  const [hydrated, setHydrated] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [backendUnavailable, setBackendUnavailable] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [seededHint, setSeededHint] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BrainFormValues>({
    resolver: zodResolver(brainAutosaveSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const { fields: competitorFields, append, remove } = useFieldArray({
    control,
    name: "competitors",
  })

  useEffect(() => {
    if (!organizationId || kitPending || hydrated) return

    if (kit && kit.companyName?.trim()) {
      reset(brandKitToForm(kit))
      setBackendUnavailable(false)
      setIsEmpty(false)
    } else {
      setBackendUnavailable(kitError || !kit)
      try {
        const local = localStorage.getItem(`${LOCAL_KEY}.${organizationId}`)
        if (local) {
          const parsed = JSON.parse(local) as BrandKit
          if (parsed.companyName?.trim()) {
            reset(brandKitToForm(parsed))
            setIsEmpty(false)
          } else {
            setIsEmpty(true)
          }
        } else {
          setIsEmpty(true)
        }
      } catch {
        setIsEmpty(true)
      }
    }
    try {
      const key = `veqiro.brain.seeded.${organizationId}`
      if (localStorage.getItem(key) === "1") {
        setSeededHint(true)
        localStorage.removeItem(key)
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [organizationId, kit, kitPending, kitError, hydrated, reset])

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
    setIsEmpty(false)
    setSeededHint(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const values = getValues()
      persistLocally(values)
      try {
        const result = await saveMutation.mutateAsync(formToBrandKit(values))
        if (result.ok) {
          setHasPending(false)
          setBackendUnavailable(false)
          setLastSavedAt(currentTimestamp())
        } else if (result.unavailable) {
          setBackendUnavailable(true)
          setHasPending(false)
          setLastSavedAt(currentTimestamp())
        } else {
          toast.error(result.message ?? "Auto-save failed")
        }
      } catch {
        toast.error("Auto-save failed")
      }
    }, 800)
  }

  const onSave = async (values: BrainFormValues) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    persistLocally(values)
    try {
      const result = await saveMutation.mutateAsync(formToBrandKit(values))
      if (result.ok) {
        setHasPending(false)
        setBackendUnavailable(false)
        setLastSavedAt(currentTimestamp())
        toast.success("Brand kit saved")
      } else if (result.unavailable) {
        setBackendUnavailable(true)
        setLastSavedAt(currentTimestamp())
        toast.info("Backend offline — your changes are saved locally")
      } else {
        toast.error(result.message ?? "Failed to save brand kit")
      }
    } catch {
      toast.error("Failed to save brand kit")
    }
  }

  const handleAutoFill = async () => {
    const url = getValues("websiteUrl")
    if (!url || !/^https?:\/\//u.test(url)) {
      toast.error("Enter a valid http(s) URL first")
      return
    }
    try {
      // Server crawls + persists in one round-trip and returns the result.
      // useScrapeBrandKit invalidates the brand-kit query on success so the
      // hydrated form state will pick up crawledSummary / crawledContent on
      // the next render. Mirror it locally now for instant feedback.
      const scraped = await scrapeMutation.mutateAsync(url)
      setValue("crawledSummary", scraped.summary, {
        shouldDirty: true,
        shouldTouch: true,
      })
      setValue("crawledContent", scraped.content, {
        shouldDirty: true,
        shouldTouch: true,
      })
      toast.success(
        scraped.source === "jina"
          ? "Pulled fresh context from your site."
          : "Pulled what we could from your site (basic mode).",
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not reach that URL",
      )
    }
  }

  const saving = saveMutation.isPending
  const scraping = scrapeMutation.isPending

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl pb-8">
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
    <form
      onSubmit={(event) => void handleSubmit(onSave)(event)}
      className="mx-auto max-w-4xl pb-8"
    >
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
        <div className="mb-4 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-accent px-3 py-2.5 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-foreground shadow-[var(--vq-shadow-sm)] sm:px-4 sm:py-3 sm:text-[11px] sm:tracking-[0.1em]">
          {"// Brand Kit storage isn't reachable — your changes save locally and will sync when the backend is back."}
        </div>
      )}

      {/* Seeded-from-onboarding hint (shown once after completing onboarding) */}
      {seededHint && !isEmpty && (
        <div className="mb-4 rounded-[var(--vq-r)] border border-[#0E5C3F]/20 bg-[#DDF5E8] px-3 py-2.5 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-[#0E5C3F] shadow-[var(--vq-shadow-sm)] sm:px-4 sm:py-3 sm:text-[11px] sm:tracking-[0.1em]">
          {"// Seeded from onboarding — edit anything and it auto-saves."}
        </div>
      )}

      {/* Empty-state CTA: neither backend nor localStorage had anything */}
      {isEmpty && (
        <Card variant="brand" className="mb-4 gap-3 px-4 py-4 sm:px-5">
          <div className="font-display text-base font-semibold tracking-tight text-foreground">
            Brain is empty
          </div>
          <div className="font-body text-sm leading-relaxed text-muted-foreground">
            The fastest way to populate this is by running the onboarding flow — it collects everything your crew needs.
          </div>
          <div>
            <Button type="button" variant="brand" size="brand-sm" onClick={() => router.push("/onboarding")}>
              Run onboarding
            </Button>
          </div>
        </Card>
      )}

      <BrandKitSection
        control={control}
        errors={errors}
        competitorFields={competitorFields}
        appendCompetitor={append}
        removeCompetitor={remove}
        scheduleAutoSave={scheduleAutoSave}
        getValues={getValues}
        setValue={setValue}
        watch={watch}
        scraping={scraping}
        onAutoFill={handleAutoFill}
        organizationId={organizationId}
      />

      {/* Save status stays in page flow so it never covers the sidebar. */}
      <Card
        variant="brand"
        className="mt-4 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
      >
        <span
          aria-live="polite"
          className={`font-mono text-[10px] uppercase tracking-[0.14em] sm:text-[11px] ${
            hasPending ? "text-[#7A5A00]" : "text-muted-foreground"
          }`}
        >
          {hasPending
            ? "unsaved changes..."
            : `changes auto-saved${lastSavedAt ? ` · ${formatLastSaved(lastSavedAt)}` : ""}`}
        </span>
        <Button type="submit" variant="brand" size="brand" disabled={saving}>
          {saving ? "Saving..." : "Save brain"}
        </Button>
      </Card>
    </form>
  )
}
