import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"
import { TrialGateModal } from "@/components/billing/TrialGateModal"
import { requireSession } from "@/lib/server-session"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSession()
  
  return (
    <>
      <DashboardSidebarShell>{children}</DashboardSidebarShell>
      <TrialGateModal />
    </>
  )
}
