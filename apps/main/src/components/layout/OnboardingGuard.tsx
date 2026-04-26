"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"

// Single source of truth for "past onboarding" is `activeOrg.onboarded`.
// Earlier this guard also required a non-empty brand_kit.companyName, which
// produced an infinite redirect loop with the /onboarding layout when the
// org had onboarded=true but the brand kit was missing/empty: dashboard sent
// the user back to /onboarding, which immediately bounced them back here.
// The brain page renders fine with empty kit values, so trusting the flag
// is both safer and matches the server-side proxy at apps/main/src/proxy.ts.
export default function OnboardingGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: activeOrg, isPending: orgPending } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const isOnboarded = activeOrg?.onboarded === true
  const ok = !!organizationId && isOnboarded

  useEffect(() => {
    if (orgPending) return
    if (!organizationId || !isOnboarded) router.replace("/onboarding")
  }, [orgPending, organizationId, isOnboarded, router])

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
