"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AutoBreadcrumb } from "@/components/layout/AutoBreadcrumb"
import { Separator } from "@/components/ui/separator"
import { TrialBanner } from "@/components/billing/TrialBanner"
import { AppTour } from "@/components/tour/AppTour"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

/**
 * Only the two-pane chat view wants the sidebar out of the way — it has its own
 * 340px agent list and the two together left no room for the conversation.
 * The employee directory at /assistants is an ordinary console page and keeps
 * the sidebar; workspaces are full-screen and no longer render in this shell
 * at all.
 */
const wantsCollapsedSidebar = (p: string) =>
  p.startsWith("/assistants/") || p === "/assistants/team"

export default function DashboardSidebarShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => !wantsCollapsedSidebar(pathname))
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    const wasCollapsed = wantsCollapsedSidebar(prevPathRef.current)
    const nowCollapsed = wantsCollapsedSidebar(pathname)
    if (!wasCollapsed && nowCollapsed) queueMicrotask(() => setOpen(false))
    else if (wasCollapsed && !nowCollapsed) queueMicrotask(() => setOpen(true))
    prevPathRef.current = pathname
  }, [pathname])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <AppTour />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/92 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/78 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="min-w-0 flex-1">
            <AutoBreadcrumb />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <TrialBanner />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-5 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
