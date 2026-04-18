"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Users, Plug, Bell, CreditCard } from "lucide-react"

const SETTINGS_NAV = [
  { href: "/settings", label: "Profile", icon: User },
  { href: "/settings/members", label: "Members", icon: Users },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 border-b border-border pb-4">
      {SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs transition-colors",
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            ].join(" ")}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
