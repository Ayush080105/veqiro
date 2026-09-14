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

const isAssistantsPath = (p: string) => p.startsWith("/assistants")

export default function DashboardSidebarShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => !isAssistantsPath(pathname))
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    const wasAssistants = isAssistantsPath(prevPathRef.current)
    const nowAssistants = isAssistantsPath(pathname)
    if (!wasAssistants && nowAssistants) queueMicrotask(() => setOpen(false))
    else if (wasAssistants && !nowAssistants) queueMicrotask(() => setOpen(true))
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
