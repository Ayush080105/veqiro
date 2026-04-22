"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { getBrandKit } from "@/lib/api/brain"

type GuardState = "checking" | "ok" | "redirecting"

function localHasBrandKit(organizationId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(`veqiro.brandKitLocal.${organizationId}`)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { company_name?: string }
    return !!parsed?.company_name?.trim()
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
  const [state, setState] = useState<GuardState>("checking")

  useEffect(() => {
    if (orgPending) return

    const organizationId = activeOrg?.id
    if (!organizationId) {
      setState("redirecting")
      router.replace("/onboarding")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const bk = await getBrandKit(organizationId)
        if (cancelled) return
        const backendHasKit = !!bk?.company_name?.trim()
        if (backendHasKit) {
          setState("ok")
          return
        }
        // Backend empty or unavailable (404) — check local fallback.
        if (localHasBrandKit(organizationId)) {
          setState("ok")
          return
        }
        setState("redirecting")
        router.replace("/onboarding")
      } catch {
        if (cancelled) return
        // Treat unexpected errors as "kit missing" so user can recover via onboarding.
        setState("redirecting")
        router.replace("/onboarding")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeOrg?.id, orgPending, router])

  if (state !== "ok") {
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
