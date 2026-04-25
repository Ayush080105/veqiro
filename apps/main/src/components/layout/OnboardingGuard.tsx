"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useBrandKit } from "@/lib/api/brain"

function localHasBrandKit(organizationId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(`veqiro.brandKitLocal.${organizationId}`)
    if (!raw) return false
    // Support both legacy snake_case and current camelCase drafts.
    const parsed = JSON.parse(raw) as {
      companyName?: string
      company_name?: string
    }
    return !!(parsed?.companyName?.trim() ?? parsed?.company_name?.trim())
  } catch {
    return false
  }
}

export default function OnboardingGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: activeOrg, isPending: orgPending } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: bk, isPending: kitPending, isError } = useBrandKit(organizationId)

  const backendHasKit = !!bk?.companyName?.trim()
  const hasKit = backendHasKit || (!!organizationId && localHasBrandKit(organizationId))
  const checking = orgPending || (!!organizationId && kitPending && !isError)
  const ok = !!organizationId && !checking && hasKit

  useEffect(() => {
    if (orgPending) return
    if (!organizationId) {
      router.replace("/onboarding")
      return
    }
    if (kitPending && !isError) return
    if (!hasKit) router.replace("/onboarding")
  }, [orgPending, kitPending, isError, organizationId, hasKit, router])

  if (!ok) {
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
