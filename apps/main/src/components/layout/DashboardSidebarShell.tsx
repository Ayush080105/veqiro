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
    if (!wasAssistants && nowAssistants) setOpen(false)
    else if (wasAssistants && !nowAssistants) setOpen(true)
    prevPathRef.current = pathname
  }, [pathname])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <AutoBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
