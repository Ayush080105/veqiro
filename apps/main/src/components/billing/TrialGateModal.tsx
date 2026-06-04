"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { authClient, useSession } from "@/lib/auth-client"
import {
  billingStatusQueryKey,
  startTrial,
  useBillingStatus,
} from "@/lib/api/billing"
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
  memberships?: Array<{ id: string; role: string }> | null
}

export function TrialGateModal() {
  const { data: session, isPending } = useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const sessionActiveOrgId = (session as AugmentedSession | null | undefined)
    ?.activeOrganization?.id
  const activeOrgId = activeOrg?.id ?? sessionActiveOrgId
  const { data: billing, isPending: isBillingPending } =
    useBillingStatus(activeOrgId)
  const {
    data: activeMemberRole,
    isPending: isRolePending,
  } = authClient.useActiveMemberRole()
  const queryClient = useQueryClient()
  const [isStarting, setIsStarting] = useState(false)

  // Wait for session to resolve before deciding whether to show the modal.
  if (isPending) return null
  if (!session) return null

  if (!activeOrgId) return null
  if (isBillingPending) return null
  if (billing?.subscription != null) return null
  if (isRolePending) return null

  const isOwner = activeMemberRole?.role === "owner"

  async function handleStartTrial() {
    setIsStarting(true)
    try {
      await startTrial()
      await queryClient.invalidateQueries({
        queryKey: billingStatusQueryKey(activeOrgId),
      })
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
