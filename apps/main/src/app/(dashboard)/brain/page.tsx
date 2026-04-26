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
import { FONT } from "@/lib/fonts"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { brainAutosaveSchema, type BrainAutosaveValues } from "@/lib/schemas/brand-kit"

// Permissive auto-save schema — strict minimums live in finalizeBrainSchema and
// are enforced by /finalize.
type BrainFormValues = BrainAutosaveValues

// ─── Default Values ────────────────────────────────────────────────────────────

const DEFAULT_VALUES: BrainFormValues = {
  companyName: "",
  companyDescription: "",
  websiteUrl: "",
  industry: "",
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
}

const LOCAL_KEY = "veqiro.brandKitLocal"

function brandKitToForm(kit: BrandKit): BrainFormValues {
  return {
    companyName: kit.companyName ?? "",
    companyDescription: kit.companyDescription ?? "",
    websiteUrl: kit.websiteUrl ?? "",
    industry: kit.industry ?? "",
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
          setLastSavedAt(Date.now())
        } else if (result.unavailable) {
          setBackendUnavailable(true)
          setHasPending(false)
          setLastSavedAt(Date.now())
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
        setLastSavedAt(Date.now())
        toast.success("Brand kit saved")
      } else if (result.unavailable) {
        setBackendUnavailable(true)
        setLastSavedAt(Date.now())
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
    if (!url) {
      toast.error("Enter a website URL first")
      return
    }
    try {
      const scraped = await scrapeMutation.mutateAsync(url)
      if (!scraped || Object.keys(scraped).length === 0) {
        toast.info("Auto-fill isn't connected yet — fill fields manually for now.")
        return
      }
      const current = getValues()
      reset({
        ...current,
        ...Object.fromEntries(
          Object.entries(scraped).filter(
            ([, v]) => v !== undefined && v !== null && v !== ""
          )
        ),
        brandColors: scraped.brandColors ?? current.brandColors,
        platformTones: scraped.platformTones ?? current.platformTones,
        competitors: scraped.competitors
          ? scraped.competitors.map((c) => ({ value: c }))
          : current.competitors,
      } as BrainFormValues)
      toast.success("Auto-filled from URL")
      scheduleAutoSave()
    } catch {
      toast.error("Could not reach that URL")
    }
  }

  const saving = saveMutation.isPending
  const scraping = scrapeMutation.isPending

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
          {"// Brand Kit storage isn't reachable — your changes save locally and will sync when the backend is back."}
        </div>
      )}

      {/* Seeded-from-onboarding hint (shown once after completing onboarding) */}
      {seededHint && !isEmpty && (
        <div
          style={{
            marginBottom: 16,
            background: "#DDF5E8",
            border: "2.5px solid #0E5C3F",
            borderRadius: 10,
            boxShadow: "3px 3px 0 #0E5C3F",
            padding: "10px 14px",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1,
            color: "#0E5C3F",
          }}
        >
          {"// Seeded from onboarding — edit anything and it auto-saves."}
        </div>
      )}

      {/* Empty-state CTA: neither backend nor localStorage had anything */}
      {isEmpty && (
        <div
          style={{
            marginBottom: 16,
            background: "#FFF",
            border: "2.5px solid #111",
            borderRadius: 10,
            boxShadow: "4px 4px 0 #F06464",
            padding: "16px 20px",
            fontFamily: FONT.body,
            fontSize: 14,
            color: "#111",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontFamily: FONT.head, fontSize: 16, textTransform: "uppercase", letterSpacing: 1 }}>
            Brain is empty
          </div>
          <div style={{ color: "#555" }}>
            The fastest way to populate this is by running the onboarding flow — it collects everything your crew needs.
          </div>
          <div>
            <Button variant="brand" size="brand" onClick={() => router.push("/onboarding")}>
              Run onboarding
            </Button>
          </div>
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
        setValue={setValue}
        watch={watch}
        scraping={scraping}
        onAutoFill={handleAutoFill}
        organizationId={organizationId}
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
            {lastSavedAt ? ` · ${formatLastSaved(lastSavedAt)}` : ""}
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
        <Button type="submit" variant="brand" size="brand" disabled={saving}>
          {saving ? "Saving..." : "Save brain"}
        </Button>
      </div>
    </form>
  )
}
