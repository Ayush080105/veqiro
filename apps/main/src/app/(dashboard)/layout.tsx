import SessionGuard from "@/components/layout/SessionGuard"
import OnboardingGuard from "@/components/layout/OnboardingGuard"
import DashboardSidebarShell from "@/components/layout/DashboardSidebarShell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionGuard>
      <OnboardingGuard>
        <DashboardSidebarShell>{children}</DashboardSidebarShell>
      </OnboardingGuard>
    </SessionGuard>
  )
}
