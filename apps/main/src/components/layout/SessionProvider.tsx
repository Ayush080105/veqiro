"use client"

import { createContext, useContext, useMemo } from "react"
import { authClient } from "@/lib/auth-client"

type SessionData = ReturnType<typeof authClient.useSession>["data"]
type ActiveOrgData = ReturnType<typeof authClient.useActiveOrganization>["data"]

type SessionCtx = {
  session: SessionData
  activeOrg: ActiveOrgData
  isPending: boolean
  isSessionPending: boolean
  isOrgPending: boolean
  /**
   * Effective active organization id — falls back to session.activeOrganization.id
   * when useActiveOrganization() hasn't filled in yet (the dual-signal trick the
   * old guards relied on).
   */
  organizationId: string
  /** True if onboarded according to either signal. */
  isOnboarded: boolean
}

const Ctx = createContext<SessionCtx | null>(null)

/**
 * Single source of truth for auth state in the dashboard layout. Every
 * component that previously called `authClient.useSession()` /
 * `authClient.useActiveOrganization()` now reads from this context — the
 * underlying better-auth hooks are deduped by react-query, but reading once
 * here keeps a stable contract and makes it easy to add prefetching later.
 *
 * The proxy middleware (proxy.ts) is the authoritative auth gate; this
 * provider does NOT block rendering. Consumers handle their own pending
 * states (skeletons / placeholderData).
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const { data: activeOrg, isPending: isOrgPending } =
    authClient.useActiveOrganization()

  const value = useMemo<SessionCtx>(() => {
    const sessionActiveOrg = (
      session as { activeOrganization?: { id?: string; onboarded?: boolean } } | null | undefined
    )?.activeOrganization

    const organizationId = activeOrg?.id ?? sessionActiveOrg?.id ?? ""
    const isOnboarded =
      activeOrg?.onboarded === true || sessionActiveOrg?.onboarded === true

    return {
      session,
      activeOrg,
      isSessionPending,
      isOrgPending,
      isPending: isSessionPending || isOrgPending,
      organizationId,
      isOnboarded,
    }
  }, [session, activeOrg, isSessionPending, isOrgPending])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppSession(): SessionCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error("useAppSession must be used within <SessionProvider>")
  }
  return ctx
}

/**
 * Optional variant that returns null instead of throwing — useful for shared
 * components that may render outside the dashboard layout (e.g. on the
 * onboarding screens, which manage their own session state).
 */
export function useOptionalAppSession(): SessionCtx | null {
  return useContext(Ctx)
}
