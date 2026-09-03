"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import {
  createOrganization,
  setActiveOrganization,
  slugify,
} from "@/lib/api/organizations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { StepShell } from "../_lib/step-shell"
import { findStepBySlug } from "../_lib/steps"
import { useOnboardingForm } from "../_lib/use-onboarding-form"

const STEP = findStepBySlug("step1")!

/**
 * Step 1 — workspace (organisation) creation.
 *
 * Owns its own UI state (orgName, orgError, creating). On success, sets the
 * org active in the session and navigates to step2. If the user already has
 * an active org, skips ahead automatically.
 */
export default function Step1Workspace() {
  const router = useRouter()
  const { data: activeOrg, isPending: orgLoading } = authClient.useActiveOrganization()
  const { setValue, getValues } = useOnboardingForm()

  const [orgName, setOrgName] = useState("")
  const [orgError, setOrgError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Skip ahead if the user already has an active org.
  useEffect(() => {
    if (orgLoading) return
    if (activeOrg?.id) router.replace("/onboarding/step2")
  }, [activeOrg?.id, orgLoading, router])

  const onCreate = async () => {
    const trimmed = orgName.trim()
    if (trimmed.length < 2) {
      setOrgError("Pick a workspace name with at least 2 characters.")
      return
    }
    setOrgError(null)
    setCreating(true)
    const created = await createOrganization({
      name: trimmed,
      slug: slugify(trimmed),
    })
    if (!created.ok) {
      setOrgError(created.message)
      setCreating(false)
      return
    }
    const activated = await setActiveOrganization(created.id)
    setCreating(false)
    if (!activated.ok) {
      setOrgError(
        activated.message ??
          "Workspace created but could not be activated. Refresh and try again.",
      )
      return
    }
    // Pre-fill company name from workspace name so step 2 is one click away.
    if (!getValues("companyName")) {
      setValue("companyName", trimmed)
    }
    router.push("/onboarding/step2")
  }

  return (
    <StepShell emoji={STEP.emoji} title={STEP.title} subtitle={STEP.subtitle}>
      <div className="flex flex-col gap-1.5">
        <Label variant="brand" htmlFor="onb-org-name">
          Workspace name
        </Label>
        <Input
          id="onb-org-name"
          variant="brand"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="e.g. Lumen Beverage Co."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (!creating) void onCreate()
            }
          }}
        />
      </div>

      {orgError && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 font-body text-sm text-destructive">
          {orgError}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          variant="brand"
          size="brand"
          type="button"
          onClick={onCreate}
          disabled={creating || orgName.trim().length < 2}
        >
          {creating ? "Creating…" : "Create workspace →"}
        </Button>
      </div>
    </StepShell>
  )
}
