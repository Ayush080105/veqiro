import SessionGuard from "@/components/layout/SessionGuard"
import OnboardingGuard from "@/components/layout/OnboardingGuard"
import { SessionProvider } from "@/components/layout/SessionProvider"
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"
import { TrialBanner } from "@/components/billing/TrialBanner"
import { TrialGateModal } from "@/components/billing/TrialGateModal"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SessionGuard>
        <OnboardingGuard>
          <TrialBanner />
          <DashboardSidebarShell>{children}</DashboardSidebarShell>
          <TrialGateModal />
        </OnboardingGuard>
      </SessionGuard>
    </SessionProvider>
  )
}
