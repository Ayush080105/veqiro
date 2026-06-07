import { requireAdminSession } from "@/lib/server-session";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userEmail={session.userEmail} />
      <main className="flex-1 overflow-y-auto bg-[var(--muted)] p-6">
        {children}
      </main>
    </div>
  );
}
