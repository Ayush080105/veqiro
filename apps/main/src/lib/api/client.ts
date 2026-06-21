import { toast } from "sonner"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export class AgentNotAvailableError extends Error {
  constructor(public agentSlug: string) {
    super(`${agentSlug} isn't connected yet — backend route is being wired up.`)
    this.name = "AgentNotAvailableError"
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = "ApiError"
  }
}

type RequestOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  agentSlugForNotFound?: string
  signal?: AbortSignal
  cache?: RequestCache
}

let redirectingToLogin = false

function redirectToLogin() {
  if (typeof window === "undefined" || redirectingToLogin) return
  redirectingToLogin = true
  window.location.replace("/login")
}

export async function apiFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, agentSlugForNotFound, signal, cache } = opts
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    cache,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 404 && agentSlugForNotFound) {
    throw new AgentNotAvailableError(agentSlugForNotFound)
  }

  if (res.status === 401) {
    redirectToLogin()
    throw new ApiError(401, "Session expired")
  }

  if (!res.ok) {
    let detail = res.statusText
    let code: string | undefined
    try {
      const j = await res.json()
      detail = j.message ?? j.error ?? j.detail ?? detail
      code = j.error
    } catch {
      /* ignore */
    }
    if (res.status >= 500) {
      toast.error("Something went wrong. Please try again.")
    }
    throw new ApiError(res.status, detail, code)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
