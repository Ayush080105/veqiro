"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Menu } from "lucide-react"

import { CONSOLE_NAV } from "@/lib/config/console-nav"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { HeaderExtras } from "./HeaderExtras"
import { ModuleNavList } from "./ModuleNav"

/**
 * The module rail's mobile equivalent.
 *
 * Below `md`, `ModuleNav` is hidden and nothing replaced it — a phone could
 * reach Overview and, via the header's chat button, Chat, and nothing else.
 * This is that missing door: same modules, same order, in a sheet instead of
 * a rail, closing itself on navigation like any mobile drawer should.
 *
 * It also carries what the phone header has no room for: the employee's own
 * header extras (Maya's credits) and the console links, so a phone can leave
 * the workspace for any console page without hunting for the sidebar.
 */
export function WorkspaceMobileNav() {
  const { config } = useAgentWorkspace()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground md:hidden"
            aria-label="Open workspace modules"
          />
        }
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-(--vq-line-2)">
          <SheetTitle>{config.name}&rsquo;s workspace</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <nav aria-label="Workspace modules" className="px-2 py-3">
            <ModuleNavList onNavigate={close} />
          </nav>

          <HeaderExtras className="flex flex-wrap items-center gap-2 border-t border-(--vq-line-2) px-3 py-3 empty:hidden" />

          <nav
            aria-label="Console"
            className="mt-auto border-t border-(--vq-line-2) px-2 py-3"
          >
            <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Console
            </p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <Link
                  href="/assistants"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-[var(--vq-r-sm)] px-2 py-2.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <ArrowLeft className="size-4 shrink-0" />
                  All employees
                </Link>
              </li>
              {[...CONSOLE_NAV.primary, ...CONSOLE_NAV.secondary]
                .filter((item) => item.href !== "/assistants")
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-2.5 rounded-[var(--vq-r-sm)] px-2 py-2.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}
