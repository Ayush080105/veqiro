import { redirect } from "next/navigation"

import { isWorkspaceUiEnabled } from "@/lib/workspace/flag"
import { workspaceRedirectTarget } from "@/lib/workspace/redirect"

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

  const target = workspaceRedirectTarget({
    agent: id,
    enabled: await isWorkspaceUiEnabled(),
    searchParams: await searchParams,
  })
  if (target) redirect(target)

  return <>{children}</>
}
