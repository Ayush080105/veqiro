"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAppSession } from "@/components/layout/SessionProvider"

/**
 * Non-blocking session guard. The proxy middleware (proxy.ts) is the
 * authoritative gate for unauthenticated traffic — by the time we render here,
 * the user already has a valid session cookie. This component just handles the
 * mid-session expiry case (cookie cleared / revoked while the SPA is open) by
 * bouncing to /login, without blocking the first paint.
 */
export default function SessionGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, isSessionPending } = useAppSession()
  const bouncedRef = useRef(false)

  useEffect(() => {
    if (isSessionPending) return
    if (!session?.user && !bouncedRef.current) {
      bouncedRef.current = true
      router.replace("/login")
    }
  }, [session, isSessionPending, router])

  return <>{children}</>
}
