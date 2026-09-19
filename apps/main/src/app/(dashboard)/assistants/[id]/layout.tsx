import { redirect } from "next/navigation"

import { WORKSPACE_MIGRATED } from "@/lib/workspace/migrated"
import { isWorkspaceUiEnabled } from "@/lib/workspace/flag"

/**
 * Sends migrated agents to their workspace.
 *
 * A server layout rather than logic inside the page because the page is a
 * client component and cannot redirect(). This is also the switch that makes
 * the migration incremental: an agent moves when it is added to
 * WORKSPACE_MIGRATED, and everything else keeps serving the chat page exactly
 * as before.
 *
 * Query parameters are forwarded so existing ?action= deep links and
 * cross-agent handoffs survive the move — landing on an empty overview when
 * you clicked "draft a reply" would be a regression, not a migration.
 */
export default async function AssistantRedirectLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params

  if ((await isWorkspaceUiEnabled()) && WORKSPACE_MIGRATED.has(id as never)) {
    const resolved = (await searchParams) ?? {}
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === "string") qs.set(key, value)
      else if (Array.isArray(value) && value[0]) qs.set(key, value[0])
    }
    const query = qs.toString()
    // An ?action= link opens the action, which belongs over the chat module
    // rather than over an overview the customer did not ask for.
    const target = query ? `/workspace/${id}/chat?${query}` : `/workspace/${id}/overview`
    redirect(target)
  }

  return <>{children}</>
}
