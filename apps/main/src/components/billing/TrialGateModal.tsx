"use client"

import { useState } from "react"
import { toast } from "sonner"

import { authClient, useSession } from "@/lib/auth-client"
import { startTrial } from "@/lib/api/billing"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Shape of the session data beyond what the static types expose.
// Better Auth + dodopaymentsClient augment the session with these fields.
type AugmentedSession = {
  activeOrganization?: { id?: string; onboarded?: boolean } | null
  subscription?: Record<string, unknown> | null
  memberships?: Array<{ id: string; role: string }> | null
}

export function TrialGateModal() {
  const { data: session, isPending } = useSession()
  const [isStarting, setIsStarting] = useState(false)

  // Wait for session to resolve before deciding whether to show the modal.
  if (isPending) return null
  if (!session) return null

  const augmented = session as AugmentedSession & typeof session

  // If a subscription already exists (trial started or active), do not block.
  if (augmented.subscription != null) return null

  const activeOrgId = augmented.activeOrganization?.id
  const memberships = augmented.memberships ?? []
  const isOwner = memberships.some(
    (m) => m.id === activeOrgId && m.role === "owner"
  )

  async function handleStartTrial() {
    setIsStarting(true)
    try {
      await startTrial()
      // Bypass the cookie cache so the refreshed session reflects the new
      // subscription status immediately.
      await authClient.getSession({ query: { disableCookieCache: true } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start trial")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Dialog
      open
      // Prevent closing via outside click.
      disablePointerDismissal
      // Prevent closing via any programmatic open-change (e.g. Escape key
      // closing triggered internally). We supply a no-op handler.
      onOpenChange={() => undefined}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Start your 7-day free trial</DialogTitle>
          {isOwner ? (
            <DialogDescription>
              No credit card required. Get full access to all features for 7 days,
              completely free.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Your organization owner needs to start the trial before agents can
              be used.
            </DialogDescription>
          )}
        </DialogHeader>

        {isOwner && (
          <Button onClick={handleStartTrial} disabled={isStarting}>
            {isStarting ? "Starting trial…" : "Start free trial"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
