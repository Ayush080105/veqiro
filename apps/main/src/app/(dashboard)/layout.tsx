import SessionGuard from "@/components/layout/SessionGuard"
import OnboardingGuard from "@/components/layout/OnboardingGuard"
import { SessionProvider } from "@/components/layout/SessionProvider"
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SessionGuard>
        <OnboardingGuard>
          <DashboardSidebarShell>{children}</DashboardSidebarShell>
        </OnboardingGuard>
      </SessionGuard>
    </SessionProvider>
  )
}
