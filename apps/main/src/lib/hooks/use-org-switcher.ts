"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import { clearActiveAndStartNew, switchToOrganization } from "@/lib/api/organizations"
import { useHydrated } from "@/lib/hooks/use-hydrated"

/**
 * Organization switching, shared by the console sidebar and the workspace exit
 * menu (which has no sidebar to switch from).
 *
 * Lifted out of AppSidebar unchanged in behaviour: reads are gated on
 * hydration so the session store cannot change text mid-hydration, only one
 * switch runs at a time, and switching to the current org is a no-op.
 *
 * @param onBefore runs just before a switch/create starts — the sidebar uses it
 *   to close its mobile sheet.
 */
export function useOrgSwitcher(onBefore?: () => void) {
  const router = useRouter()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const { data: organizationList } = authClient.useListOrganizations()
  const hydrated = useHydrated()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const visibleActiveOrg = hydrated ? activeOrg : null
  const organizations = hydrated ? (organizationList ?? []) : []

  const switchOrg = async (organizationId: string) => {
    if (switchingId || organizationId === visibleActiveOrg?.id) return
    onBefore?.()
    setSwitchingId(organizationId)
    await switchToOrganization(organizationId, router)
    setSwitchingId(null)
  }

  const createOrg = async () => {
    if (switchingId) return
    onBefore?.()
    setSwitchingId("__new__")
    await clearActiveAndStartNew(router)
    setSwitchingId(null)
  }

  return { activeOrg: visibleActiveOrg, organizations, switchingId, switchOrg, createOrg }
}
