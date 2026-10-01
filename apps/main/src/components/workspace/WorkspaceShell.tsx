"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react"

import { MODULE_META } from "@/lib/workspace/modules"
import { escapeClosesDock } from "@/lib/workspace/chat-layout"
import { useDockWidth } from "@/lib/workspace/dock-store"
import { useDockPlacement } from "@/lib/workspace/use-dock-placement"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { useWorkspaceChat } from "./WorkspaceChatProvider"
import { ModuleNav } from "./ModuleNav"
import { WorkspaceMobileNav } from "./WorkspaceMobileNav"
import { AgentSwitcher } from "./AgentSwitcher"
import { ConsoleMenu } from "./ConsoleMenu"
import { HeaderExtras } from "./HeaderExtras"
import { ChatDock } from "./chat/ChatDock"
import { DockResizeHandle } from "./chat/DockResizeHandle"

/**
 * The workspace frame: full viewport, its own navigation, no console chrome.
 *
 * Desktop: module rail, the module itself, and the chat dock. Nav and dock are
 * panels rather than cards: the design system bans nested cards and this is
 * already two levels deep before a module renders anything of its own.
 *
 * Chat can be docked (beside the module at xl+, floating over it at lg–xl),
 * or be the main area (the Chat module). Below lg there is no dock — chat is
 * the Chat page — so the layout never has to squeeze a thread beside a module.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { config, activeModule, modules } = useAgentWorkspace()
  const { dockVisible, setDockOpen } = useWorkspaceChat()
  const placement = useDockPlacement()
  const [dockWidth] = useDockWidth()

  const onChatPage = activeModule === "chat"
  const moduleLabel =
    modules.find((m) => m.id === activeModule)?.label ?? MODULE_META[activeModule].label

  // A floating panel needs a way to dismiss it from the keyboard.
  useEffect(() => {
    if (!dockVisible || placement !== "overlay") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      // A dialog, menu or picker opened from inside the dock owns this Escape.
      const otherLayerOpen = !!document.querySelector(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      )
      if (escapeClosesDock({ defaultPrevented: e.defaultPrevented, otherLayerOpen })) {
        setDockOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dockVisible, placement, setDockOpen])

  return (
    // dvh, not svh: a soft keyboard or a collapsing URL bar must not push the
    // composer off-screen.
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-(--vq-line-2) bg-card px-2 py-2 sm:gap-2 sm:px-4">
        {/* Below md the module rail is hidden — this is the way in to Work,
            Approvals, Automations, Memory, Integrations and Settings there. */}
        <WorkspaceMobileNav />

        {/* The way out, to anywhere in the console. */}
        <ConsoleMenu />

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden shrink-0 gap-1.5 px-2 text-muted-foreground sm:inline-flex"
        >
          <Link href="/assistants" aria-label="Back to your employees">
            <ArrowLeft className="size-4" />
            Employees
          </Link>
        </Button>

        <span className="hidden h-5 w-px shrink-0 bg-(--vq-line-2) sm:block" />

        {/* Identity and employee switcher in one control. */}
        <h1 className="sr-only">{config.name}</h1>
        <AgentSwitcher subtitle={config.role} compactSubtitle={moduleLabel} />
        <span className="flex-1" />

        <HeaderExtras className="hidden shrink-0 items-center gap-2 md:flex" />

        <ChatToggle />

        <ThemeToggle />
      </header>

      <div className="relative flex min-h-0 flex-1">
        <ModuleNav />

        <main
          className={cn(
            "min-w-0 flex-1",
            onChatPage ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto",
          )}
        >
          {onChatPage ? (
            children
          ) : (
            // Capped and centred: a module list stretched across a 2560px
            // monitor is unreadable, and the PRD asks for work objects rather
            // than a wall of full-bleed panels.
            <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">{children}</div>
          )}
        </main>

        {dockVisible && (
          <aside
            aria-label="Chat"
            className={cn(
              "hidden min-h-0 border-l border-(--vq-line-2) bg-card lg:flex",
              // lg–xl: float over the module rather than squeezing it.
              "absolute inset-y-0 right-0 z-30 w-[400px] max-w-[92vw] shadow-(--vq-shadow-lg)",
              // xl+: sit beside it at the width the customer chose.
              // max-w is a hard ceiling that also holds when the window shrinks after the
              // width was chosen: the module keeps at least 520px beside the 208px rail.
              "xl:relative xl:inset-auto xl:z-auto xl:w-(--dock-w) xl:max-w-[calc(100vw-728px)] xl:shrink-0 xl:shadow-none",
            )}
            style={{ ["--dock-w" as string]: `${dockWidth}px` }}
          >
            <DockResizeHandle />
            <ChatDock />
          </aside>
        )}
      </div>
    </div>
  )
}

/**
 * The header's chat control.
 *
 * lg and up: toggles the docked column — or, on the Chat page, puts the chat
 * back beside the work. Below lg there is no dock, so it is a plain link to the
 * Chat page.
 */
function ChatToggle() {
  const { agent, activeModule } = useAgentWorkspace()
  const { dockVisible, toggleDock, collapseChat } = useWorkspaceChat()
  const onChatPage = activeModule === "chat"

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onChatPage ? collapseChat : toggleDock}
        className={cn(
          "hidden shrink-0 gap-1.5 text-muted-foreground lg:inline-flex",
          (dockVisible || onChatPage) && "bg-muted text-foreground",
        )}
        aria-pressed={dockVisible || onChatPage}
        aria-label={
          onChatPage ? "Dock chat beside the work" : dockVisible ? "Hide chat" : "Show chat"
        }
      >
        {dockVisible || onChatPage ? (
          <PanelRightClose className="size-4" />
        ) : (
          <PanelRightOpen className="size-4" />
        )}
        Chat
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={cn(
          "shrink-0 text-muted-foreground lg:hidden",
          onChatPage && "bg-muted text-foreground",
        )}
      >
        <Link
          href={`/workspace/${agent}/chat`}
          aria-label="Open chat"
          aria-current={onChatPage ? "page" : undefined}
        >
          <MessageSquare className="size-4" />
        </Link>
      </Button>
    </>
  )
}
