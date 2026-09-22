"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { ModuleNavList } from "./ModuleNav"

/**
 * The module rail's mobile equivalent.
 *
 * Below `md`, `ModuleNav` is hidden and nothing replaced it — a phone could
 * reach Overview and, via the header's chat button, Chat, and nothing else.
 * This is that missing door: same modules, same order, in a sheet instead of
 * a rail, closing itself on navigation like any mobile drawer should.
 */
export function WorkspaceMobileNav() {
  const { config } = useAgentWorkspace()
  const [open, setOpen] = useState(false)

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
        <nav aria-label="Workspace modules" className="flex-1 overflow-y-auto px-2 py-3">
          <ModuleNavList onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
