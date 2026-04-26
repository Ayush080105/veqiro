"use client"

import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"

// Render gate only — the actual onboarded/not-onboarded routing decision lives
// in apps/main/src/proxy.ts so there's a single source of truth and we avoid
// the client-side bounce that used to race the middleware (and produced the
// infinite /onboarding ↔ /dashboard loop after finalize).
//
// Why we still render-gate here: the dashboard pages render Active-org-keyed
// data, and on the very first paint after sign-in `useActiveOrganization()`
// is briefly pending. Without this gate consumers get a flash of empty state.
//
// Dual-signal read: useActiveOrganization() caches and only re-fetches when
// the active-org slot ID changes — not when the same org's onboarded flag
// flips after finalize. The session response (via customSession on the
// server) always returns a fresh `activeOrganization.onboarded`, so we read
// from there as a belt-and-suspenders signal. Whichever says "true" wins.
export default function OnboardingGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: activeOrg, isPending: orgPending } =
    authClient.useActiveOrganization()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const sessionOnboarded = (
    session as { activeOrganization?: { onboarded?: boolean } } | null | undefined
  )?.activeOrganization?.onboarded === true
  const orgOnboarded = activeOrg?.onboarded === true
  const isOnboarded = orgOnboarded || sessionOnboarded
  const organizationId =
    activeOrg?.id ??
    (session as { activeOrganization?: { id?: string } } | null | undefined)
      ?.activeOrganization?.id ??
    ""

  // While either signal is loading, keep the spinner — proxy.ts has already
  // verified auth + onboarded server-side before we got here, so this is just
  // about waiting for the client cache to catch up before painting children.
  const stillLoading = orgPending && sessionPending

  if (stillLoading || !organizationId || !isOnboarded) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#EFE7D6" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#111" }} />
      </div>
    )
  }

  return <>{children}</>
}
