"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Users, Plug, Bell, CreditCard, BarChart3 } from "lucide-react"
import { FONT } from "@/lib/fonts"

const SETTINGS_NAV = [
  { href: "/settings", label: "Profile", icon: User, color: "var(--vq-red)" },
  // { href: "/settings/members", label: "Members", icon: Users, color: "var(--vq-green)" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, color: "var(--vq-yellow)" },
  // { href: "/settings/notifications", label: "Notifications", icon: Bell, color: "var(--vq-pink)" },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, color: "var(--vq-blue)" },
  { href: "/settings/usage", label: "Usage", icon: BarChart3, color: "var(--vq-green)" },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid var(--vq-line)",
        paddingBottom: 14,
      }}
    >
      {SETTINGS_NAV.map(({ href, label, icon: Icon, color }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid var(--vq-line-2)",
              background: active ? color : "#FFF9ED",
              boxShadow: active ? "var(--vq-shadow-sm)" : "none",
              color: "#111",
              textDecoration: "none",
              fontFamily: FONT.body,
              fontSize: 13,
              fontWeight: 500,
              transition: "box-shadow 120ms ease",
            }}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
