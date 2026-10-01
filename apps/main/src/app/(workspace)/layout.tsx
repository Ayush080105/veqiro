import { ScheduledPostFailureAlert } from "@/components/agents/maya/ScheduledPostFailureAlert"
import { TrialGateModal } from "@/components/billing/TrialGateModal"
import { requireSession } from "@/lib/server-session"

/**
 * Workspaces get the whole screen.
 *
 * Deliberately outside the (dashboard) group rather than inside it. A
 * workspace is not a page within the console — it is the place you go to work
 * as one employee, and wrapping it in the app sidebar, the breadcrumb bar and
 * the console's page padding made it read as a tab you were visiting rather
 * than a room you had entered. It also cost roughly 300px of width to chrome
 * that the workspace's own navigation already provides.
 *
 * Same session guarantee as the dashboard, and the two global modals come
 * along because they are genuinely global — a scheduled post that failed
 * matters just as much while you are inside Maya as outside her.
 */
export default async function WorkspaceRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()

  return (
    <>
      {children}
      <TrialGateModal />
      <ScheduledPostFailureAlert />
    </>
  )
}
