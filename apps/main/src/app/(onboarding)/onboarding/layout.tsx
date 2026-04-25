"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  useForm,
  FormProvider,
  useWatch,
  type SubmitHandler,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { authClient } from "@/lib/auth-client"
import { getBrandKit, finalizeBrandKit } from "@/lib/api/brain"
import Logo from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/ui/sticker"
import { onboardingSchema, type OnboardingValues } from "@/lib/schemas/brand-kit"
import { cn } from "@/lib/utils"

import {
  STEPS,
  TOTAL_STEPS,
  findStepBySlug,
  prevStep,
  nextStep,
} from "./_lib/steps"
import {
  DEFAULT_VALUES,
  brandKitToValues,
  valuesToBrandKit,
} from "./_lib/converters"
import { DRAFT_KEY } from "./_lib/constants"

// ─── Helpers ────────────────────────────────────────────────────────────────

function readDraft(): OnboardingValues {
  if (typeof window === "undefined") return DEFAULT_VALUES
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    return saved ? { ...DEFAULT_VALUES, ...JSON.parse(saved) } : DEFAULT_VALUES
  } catch {
    return DEFAULT_VALUES
  }
}

function getCurrentSlug(pathname: string): string | null {
  // Pathname looks like /onboarding/step3
  const match = pathname.match(/\/onboarding\/(step\d+)\/?$/u)
  return match ? match[1] : null
}

// ─── Header ────────────────────────────────────────────────────────────────

function OnboardingHeader({ stepIndex }: { stepIndex: number }) {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b-[3px] border-foreground bg-background px-8 py-5">
      <Link href="/" className="flex items-center gap-2.5 text-foreground">
        <Logo className="w-10 h-10" />
        <span className="font-head text-xl tracking-tight">veqiro</span>
      </Link>
      <div className="rounded-full border-2 border-foreground bg-secondary px-3.5 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
        Step {stepIndex} / {TOTAL_STEPS}
      </div>
    </nav>
  )
}

// ─── Progress bar ──────────────────────────────────────────────────────────

function Progress({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const n = i + 1
        return (
          <div
            key={n}
            className={cn(
              "h-2.5 flex-1 rounded-full border-2 border-foreground transition-colors duration-200",
              n < stepIndex && "bg-[color:var(--vq-green)]",
              n === stepIndex && "bg-[color:var(--vq-yellow)]",
              n > stepIndex && "bg-background",
            )}
          />
        )
      })}
    </div>
  )
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  // Belt-and-suspenders: useActiveOrganization caches and only re-fetches when
  // the active-org slot CHANGES, not when the same org's onboarded flag flips
  // server-side after finalize. The session response (via customSession on the
  // server) always includes a fresh `activeOrganization.onboarded`, so read it
  // from there too. Whichever signal is true wins.
  const sessionActiveOrgOnboarded = (
    session as { activeOrganization?: { onboarded?: boolean } } | null | undefined
  )?.activeOrganization?.onboarded
  const isOnboarded = activeOrg?.onboarded === true || sessionActiveOrgOnboarded === true

  const slug = getCurrentSlug(pathname)
  const currentStep = slug ? findStepBySlug(slug) : null
  const stepIndex = currentStep?.index ?? 1

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    // Always boot with DEFAULT_VALUES so the SSR markup matches the first
    // client render. localStorage is read AFTER mount in the effect below to
    // avoid a hydration mismatch.
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  })
  const { control, getValues, reset, trigger, handleSubmit } = form

  const [saving, setSaving] = React.useState(false)
  const [draftLoaded, setDraftLoaded] = React.useState(false)

  // Hydrate from localStorage AFTER mount. Runs once.
  React.useEffect(() => {
    const draft = readDraft()
    // Shallow check to skip the reset when there's no actual saved draft.
    if (draft !== DEFAULT_VALUES) {
      reset(draft)
    }
    setDraftLoaded(true)
  }, [reset])

  // ── Guards ───────────────────────────────────────────────────────────────

  // Bounce already-onboarded users to the dashboard.
  React.useEffect(() => {
    if (orgLoading || sessionLoading) return
    if (isOnboarded) {
      router.replace("/dashboard")
    }
  }, [isOnboarded, orgLoading, sessionLoading, router])

  // Session gate.
  React.useEffect(() => {
    if (sessionLoading) return
    if (!session?.user) router.replace("/login")
  }, [session, sessionLoading, router])

  // ── Hydrate from backend ─────────────────────────────────────────────────

  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => {
    if (!organizationId || hydrated) return
    if (isOnboarded) return
    let cancelled = false
    getBrandKit(organizationId).then((bk) => {
      if (cancelled || !bk) {
        if (!cancelled) setHydrated(true)
        return
      }
      const next = brandKitToValues(bk)
      const current = getValues()
      // Backend non-empty fields override local draft so half-saved progress
      // from a previous session is preserved.
      reset({
        ...current,
        ...Object.fromEntries(
          Object.entries(next).filter(
            ([, v]) => v !== "" && v !== null && v !== undefined,
          ),
        ),
      })
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [organizationId, isOnboarded, reset, getValues, hydrated])

  // ── Draft persistence ────────────────────────────────────────────────────

  const watched = useWatch({ control })
  React.useEffect(() => {
    // Don't persist until after the localStorage→form rehydration has run,
    // otherwise the initial DEFAULT_VALUES snapshot would clobber a real draft.
    if (!draftLoaded) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(watched))
    } catch {
      /* ignore */
    }
  }, [watched, draftLoaded])

  // ── Step access guard ────────────────────────────────────────────────────
  // If user direct-links to a step they haven't earned access to, bounce them
  // to the first incomplete step. We trust the form values + active org to
  // decide.
  React.useEffect(() => {
    if (orgLoading || sessionLoading || !slug) return
    // Already onboarded — let the onboarded effect above redirect to /dashboard.
    // Otherwise this guard would race it and replace into a step instead.
    if (isOnboarded) return
    const step = findStepBySlug(slug)
    if (!step) return

    // Step 1 is always accessible. Other steps require an active org.
    if (step.index > 1 && !organizationId) {
      router.replace("/onboarding/step1")
      return
    }

    // Validate previous steps' fields. If any prior step's fields fail, bounce
    // back to that step. Skip step 1 (no RHF fields).
    void (async () => {
      for (const prior of STEPS) {
        if (prior.index >= step.index) break
        if (prior.fields.length === 0) continue
        const ok = await trigger(prior.fields, { shouldFocus: false })
        if (!ok) {
          router.replace(`/onboarding/${prior.slug}`)
          return
        }
      }
    })()
  }, [slug, organizationId, orgLoading, sessionLoading, isOnboarded, router, trigger])

  // ── Continue / Finalize ──────────────────────────────────────────────────

  const goPrev = () => {
    if (!currentStep) return
    const prev = prevStep(currentStep.slug)
    if (prev) router.push(`/onboarding/${prev.slug}`)
  }

  const goNext = async () => {
    if (!currentStep) return
    if (currentStep.fields.length > 0) {
      const ok = await trigger(currentStep.fields)
      if (!ok) {
        toast.error("Fix the highlighted fields to continue.")
        return
      }
    }
    const next = nextStep(currentStep.slug)
    if (next) router.push(`/onboarding/${next.slug}`)
  }

  const onFinish: SubmitHandler<OnboardingValues> = async (values) => {
    if (!organizationId) {
      toast.error("No workspace found. Create one first.")
      router.replace("/onboarding/step1")
      return
    }
    setSaving(true)
    try {
      const payload = valuesToBrandKit(values)
      const result = await finalizeBrandKit(organizationId, payload)

      // Persist a local snapshot for fast brain-page hydration.
      try {
        localStorage.setItem(
          `veqiro.brandKitLocal.${organizationId}`,
          JSON.stringify(payload),
        )
        localStorage.setItem(`veqiro.brain.seeded.${organizationId}`, "1")
      } catch {
        /* ignore */
      }

      if (!result.ok) {
        const fieldErrors = result.fieldErrors ?? {}
        const firstField = Object.keys(fieldErrors)[0]
        const message =
          fieldErrors[firstField] ?? result.message ?? "Could not save brand kit."
        toast.error(message)
        // Bounce to the step that owns the failing field, if known.
        const owningStep = STEPS.find((s) =>
          s.fields.includes(firstField as keyof OnboardingValues),
        )
        if (owningStep) router.push(`/onboarding/${owningStep.slug}`)
        setSaving(false)
        return
      }

      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      toast.success("Brand kit saved. Meet the crew.")
      router.push("/dashboard")
    } catch {
      toast.error("Could not save brand kit. Your draft is kept locally.")
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Step 1 renders without the layout's footer nav (it has its own create-org
  // button). Index page (slug=null) just renders children (it'll redirect).
  const isStep1 = slug === "step1"
  const isLastStep = currentStep?.index === TOTAL_STEPS

  return (
    <FormProvider {...form}>
      <div className="min-h-screen bg-background">
        <div className="noise-overlay" aria-hidden />
        <OnboardingHeader stepIndex={stepIndex} />

        <form
          onSubmit={handleSubmit(onFinish)}
          className="relative px-6 pb-20 pt-10"
        >
          {currentStep && (
            <div className="mx-auto mb-7 max-w-2xl">
              <div className="mb-3 flex items-center justify-between">
                <Sticker rotate={-4} tone="green">
                  Step {stepIndex} of {TOTAL_STEPS}
                </Sticker>
                <div className="font-mono text-xs text-muted-foreground">
                  ≈ {Math.max(1, TOTAL_STEPS - stepIndex) * 2} min left
                </div>
              </div>
              <Progress stepIndex={stepIndex} />
            </div>
          )}

          <div className="absolute left-[6%] top-40 z-0">
            <Sticker rotate={-14} tone="yellow">
              briefing in progress
            </Sticker>
          </div>
          <div className="absolute right-[6%] top-56 z-0">
            <Sticker rotate={10} tone="red">
              auto-saved ✦
            </Sticker>
          </div>

          <div className="relative z-10">{children}</div>

          {currentStep && !isStep1 && (
            <div className="mx-auto mt-7 flex max-w-2xl items-center justify-between gap-4">
              <Button
                variant="brand-ghost"
                size="brand"
                type="button"
                onClick={goPrev}
                disabled={saving}
              >
                ← Back
              </Button>
              {isLastStep ? (
                <Button
                  variant="brand-dark"
                  size="brand"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Meet the crew →"}
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="brand"
                  type="button"
                  onClick={goNext}
                >
                  Continue →
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
    </FormProvider>
  )
}
