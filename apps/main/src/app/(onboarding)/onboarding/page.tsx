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
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization()
  const { trigger } = useOnboardingForm()

  useEffect(() => {
    if (orgLoading) return
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
  }, [activeOrg?.id, orgLoading, router, trigger])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-foreground" />
    </div>
  )
}
