"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/layout/SessionProvider"

/**
 * Non-blocking onboarding guard. The proxy middleware (proxy.ts) is the
 * authoritative gate that bounces non-onboarded users to /onboarding before
 * the dashboard tree even mounts — this component is just a belt-and-
 * suspenders check for the rare case where the client cache says "not
 * onboarded" after the proxy let the request through.
 *
 * It does NOT render a spinner. Pages handle their own pending states via
 * react-query placeholderData / skeletons keyed off `organizationId`.
 *
 * Dual-signal: useActiveOrganization() caches the org slot and won't see an
 * onboarded flip on the same org id; the session response from customSession
 * always returns a fresh `activeOrganization.onboarded`, so we trust either.
 * That logic now lives in SessionProvider — we just consume `isOnboarded`.
 */
export default function OnboardingGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isPending, isOnboarded, organizationId } = useAppSession()
  const bouncedRef = useRef(false)

  useEffect(() => {
    if (isPending) return
    // Both auth signals settled and we still don't see an onboarded org —
    // the proxy will catch this on hard nav, but on a client-side push we
    // need to bounce ourselves. One-shot ref prevents bounce loops.
    if ((!organizationId || !isOnboarded) && !bouncedRef.current) {
      bouncedRef.current = true
      router.replace("/onboarding")
    }
  }, [isPending, isOnboarded, organizationId, router])

  return <>{children}</>
}
