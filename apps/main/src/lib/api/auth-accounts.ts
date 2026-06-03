export interface LinkedAccount {
  id: string
  providerId: string
  createdAt?: string
  updatedAt?: string
  accountId?: string
  scopes?: string[]
}

function authUrl(): string {
  const version = process.env.NEXT_PUBLIC_API_VERSION || "v1"
  // In the browser always use the Next.js proxy so cookies are handled correctly
  if (typeof window !== "undefined") {
    return `/api/${version}/auth`
  }
  // SSR: call the backend directly
  const base = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:5000"
  return `${base}/api/${version}/auth`
}

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const res = await fetch(`${authUrl()}/list-accounts`, {
    method: "GET",
    credentials: "include",
  })
  if (!res.ok) return []
  const data = (await res.json()) as LinkedAccount[] | { accounts?: LinkedAccount[] }
  if (Array.isArray(data)) return data
  return data?.accounts ?? []
}

export async function hasGoogleConnected(): Promise<boolean> {
  const accounts = await listLinkedAccounts()
  return accounts.some((a) => a.providerId === "google")
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"

export function useGoogleConnected(enabled = true) {
  return useQuery({
    queryKey: qk.googleConnected(),
    queryFn: () => hasGoogleConnected(),
    enabled,
    placeholderData: (prev) => prev,
  })
}
