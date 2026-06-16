"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Users, Plug, Bell, CreditCard, MessageSquarePlus, MailCheck } from "lucide-react"
import { FONT } from "@/lib/fonts"

const SETTINGS_NAV = [
  { href: "/settings", label: "Profile", icon: User, color: "var(--vq-red)" },
  { href: "/settings/members", label: "Members", icon: Users, color: "var(--vq-green)" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, color: "var(--vq-yellow)" },
  { href: "/settings/vega", label: "Email Settings", icon: MailCheck, color: "#E8F4FD" },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, color: "var(--vq-pink)" },
  { href: "/settings/billing", label: "Billing", icon: CreditCard, color: "var(--vq-blue)" },
  { href: "/settings/feedback", label: "Feedback", icon: MessageSquarePlus, color: "var(--vq-violet)" },
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
        borderBottom: "3px solid #111",
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
              border: "2.5px solid #111",
              background: active ? color : "#FFF9ED",
              boxShadow: active ? "3px 3px 0 #111" : "none",
              color: "#111",
              textDecoration: "none",
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              transition: "transform 120ms ease, box-shadow 120ms ease",
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
