"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Zap, Building2, Globe, Bot, Users, LogOut, ClipboardList } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview", Icon: LayoutDashboard },
  { href: "/usage", label: "Usage", Icon: Zap },
  { href: "/organizations", label: "Organizations", Icon: Building2 },
  { href: "/integrations", label: "Integrations", Icon: Globe },
  { href: "/agents", label: "Agents", Icon: Bot },
  { href: "/users", label: "Users", Icon: Users },
  { href: "/waitlist", label: "Waitlist", Icon: ClipboardList },
] as const;

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <aside className="flex h-full w-52 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <p className="text-sm font-semibold tracking-tight">Veqiro Admin</p>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <p className="truncate text-xs text-[var(--muted-foreground)]">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
