"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { useOnboardingForm } from "./_lib/use-onboarding-form"
import { STEPS } from "./_lib/steps"

/**
 * Index landing — picks the right step to start at.
 *
 * Rules:
 * 1. If user has no active org → step1 (create workspace).
 * 2. Otherwise walk STEPS, run trigger() for each, jump to the first that fails.
 * 3. All clear → step7 (review + finalize).
 */
export default function OnboardingIndex() {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization()
  const { trigger } = useOnboardingForm()

  // Same dual-signal as the layout — useActiveOrganization caches and doesn't
  // pick up an `onboarded` flip on the same org, so also read from the session.
  const sessionActiveOrgOnboarded = (
    session as { activeOrganization?: { onboarded?: boolean } } | null | undefined
  )?.activeOrganization?.onboarded
  const isOnboarded = activeOrg?.onboarded === true || sessionActiveOrgOnboarded === true

  useEffect(() => {
    if (orgLoading || sessionLoading) return
    // Already onboarded — let the layout redirect to /dashboard. Skip the
    // step-walk so we don't race-condition replace ourselves into a step.
    if (isOnboarded) return
    let cancelled = false
    void (async () => {
      if (!activeOrg?.id) {
        if (!cancelled) router.replace("/onboarding/step1")
        return
      }
      for (const step of STEPS) {
        if (step.index === 1) continue // step1 is org creation, already past
        if (step.fields.length === 0) continue
        const ok = await trigger(step.fields, { shouldFocus: false })
        if (!ok) {
          if (!cancelled) router.replace(`/onboarding/${step.slug}`)
          return
        }
      }
      if (!cancelled) router.replace("/onboarding/step7")
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrg?.id, orgLoading, sessionLoading, isOnboarded, router, trigger])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-foreground" />
    </div>
  )
}
