"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { usePublishedPosts } from "@/lib/api/assistants"

const SEEN_KEY = "maya-failed-scheduled-posts-seen"

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

// Same-browser nicety alongside the failure email (see maya.notifications.ts
// server-side) — not a real notification center, just a dedup-via-localStorage
// toast for failed scheduled posts the user hasn't seen yet.
export function ScheduledPostFailureAlert() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: posts = [] } = usePublishedPosts(organizationId)

  useEffect(() => {
    const failed = posts.filter((p) => p.status === "failed" && p.scheduledAt)
    if (failed.length === 0) return

    const seen = loadSeen()
    const unseen = failed.filter((p) => !seen.has(p.id))
    if (unseen.length === 0) return

    unseen.forEach((p) => {
      toast.error(`Scheduled ${p.platform.toLowerCase()} post failed: ${p.error ?? "unknown error"}`)
      seen.add(p.id)
    })
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  }, [posts])

  return null
}
