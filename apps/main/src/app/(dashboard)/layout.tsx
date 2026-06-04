
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"
import { TrialBanner } from "@/components/billing/TrialBanner"
import { TrialGateModal } from "@/components/billing/TrialGateModal"
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session=await requireSession()
  
  return (
    <>
      <TrialBanner />
      <DashboardSidebarShell>{children}</DashboardSidebarShell>
      <TrialGateModal />
    </>
  )
}
