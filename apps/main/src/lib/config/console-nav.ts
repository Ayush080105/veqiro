import {
  Brain,
  CalendarClock,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface ConsoleNavEntry {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * The console's top-level destinations — one list, used by the app sidebar and
 * by the workspace's exit menu, so the way out of a full-screen workspace can
 * never drift from the sidebar it is replacing.
 */
export const CONSOLE_NAV: { primary: ConsoleNavEntry[]; secondary: ConsoleNavEntry[] } = {
  primary: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    // "Employees", not "Assistants": the product model is people you have hired,
    // and the directory this points at is the workforce rather than a chat list.
    { href: "/assistants", label: "Employees", icon: Users },
    { href: "/tasks", label: "Tasks", icon: CalendarClock },
  ],
  secondary: [
    { href: "/feedback", label: "Community", icon: MessageSquare },
    { href: "/brain", label: "Brain", icon: Brain },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
}
