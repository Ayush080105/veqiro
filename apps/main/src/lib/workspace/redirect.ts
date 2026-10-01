import { WORKSPACE_MIGRATED } from "./migrated"

/**
 * Where /assistants/<id> should send someone, if anywhere.
 *
 * A pure function rather than logic inline in the server layout, because this
 * is the switch the whole migration turns on and the interesting parts — which
 * agents move, and what happens to a deep link's query string — deserve to be
 * testable without a browser and a session.
 *
 * Returns null to mean "stay on the chat page".
 */
export function workspaceRedirectTarget({
  agent,
  enabled,
  searchParams,
  migrated = WORKSPACE_MIGRATED,
}: {
  agent: string
  enabled: boolean
  searchParams?: Record<string, string | string[] | undefined>
  /** Which agents have moved. Injectable so the rollback path stays testable. */
  migrated?: ReadonlySet<string>
}): string | null {
  if (!enabled) return null
  if (!migrated.has(agent)) return null

  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string") qs.set(key, value)
    else if (Array.isArray(value) && value[0] !== undefined) qs.set(key, value[0])
  }
  const query = qs.toString()

  // An ?action= link means the customer clicked "draft a reply", so land them
  // on chat with the form opening over it — not on an overview they did not
  // ask for, which would lose the task they were in the middle of.
  return query ? `/workspace/${agent}/chat?${query}` : `/workspace/${agent}/overview`
}
