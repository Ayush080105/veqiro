import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { qk } from "@/lib/query-keys"

export type SocialPlatformEnum = "TWITTER" | "LINKEDIN" | "INSTAGRAM"
export type SocialPlatformSlug = "twitter" | "linkedin" | "instagram"

export interface SocialAccount {
  id: string
  organizationId: string
  userId: string
  platform: SocialPlatformEnum
  providerAccountId: string
  accountName: string | null
  scope: string | null
  metadata: Record<string, unknown> | null
  accessTokenExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

export const platformSlugToEnum: Record<SocialPlatformSlug, SocialPlatformEnum> = {
  twitter: "TWITTER",
  linkedin: "LINKEDIN",
  instagram: "INSTAGRAM",
}

export const platformEnumToSlug: Record<SocialPlatformEnum, SocialPlatformSlug> = {
  TWITTER: "twitter",
  LINKEDIN: "linkedin",
  INSTAGRAM: "instagram",
}

export async function listIntegrations(): Promise<SocialAccount[]> {
  try {
    return await apiFetch<SocialAccount[]>("/integrations")
  } catch {
    return []
  }
}

export async function disconnectIntegration(id: string): Promise<void> {
  await apiFetch<void>(`/integrations/${id}`, { method: "DELETE" })
}

export function authorizeUrl(platform: SocialPlatformSlug): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? ""
  return `${base}/integrations/${platform}/authorize`
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: qk.integrations(),
    queryFn: () => listIntegrations(),
  })
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => disconnectIntegration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.integrations() })
    },
  })
}
