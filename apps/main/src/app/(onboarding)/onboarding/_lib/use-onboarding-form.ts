"use client"

import { useFormContext } from "react-hook-form"
import type { OnboardingValues } from "@/lib/schemas/brand-kit"

/**
 * Typed wrapper around RHF's useFormContext for the onboarding form.
 * Step pages call this instead of importing useFormContext + retyping the
 * generic.
 */
export function useOnboardingForm() {
  return useFormContext<OnboardingValues>()
}
