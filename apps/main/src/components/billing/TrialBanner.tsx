"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { X } from "lucide-react"

const DISMISS_KEY = "billing.trialBanner.dismissed"

export function TrialBanner() {
  const { data: session } = useSession()
  const sub = (session as any)?.subscription
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
    }
  }, [])

  if (!sub) return null
  if (sub.status !== "TRIALING") return null

  const days = sub.daysRemaining ?? 0
  const forceShow = days <= 2

  if (dismissed && !forceShow) return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2 text-xs">
      <span>
        <strong>{days}</strong> {days === 1 ? "day" : "days"} left in your trial.
      </span>
      <div className="flex items-center gap-2">
        <Link href="/settings/billing" className="font-medium text-primary hover:underline">
          Upgrade now →
        </Link>
        {!forceShow && (
          <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
