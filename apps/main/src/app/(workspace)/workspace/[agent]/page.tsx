import { redirect } from "next/navigation"

/**
 * /workspace/<agent> has no page of its own — the workspace opens on Overview.
 * A redirect rather than rendering Overview here keeps one canonical URL per
 * module, so links, the back button and the nav's active state all agree.
 */
export default async function AgentWorkspaceIndex({
  params,
}: {
  params: Promise<{ agent: string }>
}) {
  const { agent } = await params
  redirect(`/workspace/${agent}/overview`)
}
