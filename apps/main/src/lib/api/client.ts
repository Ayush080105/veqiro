const API_URL = process.env.NEXT_PUBLIC_API_URL

export class AgentNotAvailableError extends Error {
  constructor(public agentSlug: string) {
    super(`${agentSlug} isn't connected yet — backend route is being wired up.`)
    this.name = "AgentNotAvailableError"
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "ApiError"
  }
}

type RequestOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  agentSlugForNotFound?: string
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, agentSlugForNotFound, signal } = opts
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 404 && agentSlugForNotFound) {
    throw new AgentNotAvailableError(agentSlugForNotFound)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = j.message ?? j.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}
