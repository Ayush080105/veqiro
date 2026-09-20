"use client"

import { Suspense, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react"

import { AGENT_PHOTOS } from "@/lib/config/agents"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { useWorkspaceChat } from "./WorkspaceChatProvider"
import { ModuleNav } from "./ModuleNav"
import { AgentSwitcher } from "./AgentSwitcher"
import { ChatDock } from "./chat/ChatDock"

/**
 * The workspace frame: full viewport, its own navigation, no console chrome.
 *
 * Three columns on desktop — module rail, the module itself, and the chat
 * dock. Nav and dock are panels rather than cards: the design system bans
 * nested cards and this is already two levels deep before a module renders
 * anything of its own.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { agent, config } = useAgentWorkspace()
  const { dockOpen, toggleDock } = useWorkspaceChat()
  const photo = AGENT_PHOTOS[agent]

  return (
    <div className="flex h-svh min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-(--vq-line-2) bg-card px-3 py-2.5 sm:gap-3 sm:px-4">
        {/* The way out. A full-screen surface needs one that is always visible. */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 px-2 text-muted-foreground"
        >
          <Link href="/assistants" aria-label="Back to your employees">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Employees</span>
          </Link>
        </Button>

        <span className="hidden h-5 w-px shrink-0 bg-(--vq-line-2) sm:block" />

        <span
          className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border"
          style={{ background: config.color }}
        >
          {photo ? (
            <Image src={photo} alt={config.name} fill sizes="32px" className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-head text-[11px] text-white">
              {config.initials}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-head text-sm leading-tight">{config.name}</h1>
          {/* The role, not a feature list — the point is that this is a job. */}
          <p className="truncate text-xs text-muted-foreground">{config.role}</p>
        </div>

        <HeaderExtras />

        {/* Move between employees without going back out and in again. */}
        <AgentSwitcher />

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDock}
          className="hidden shrink-0 gap-1.5 text-muted-foreground lg:inline-flex"
          aria-label={dockOpen ? "Hide chat" : "Show chat"}
        >
          {dockOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
          Chat
        </Button>
        <Button asChild variant="ghost" size="icon" className="shrink-0 lg:hidden">
          <Link href={`/workspace/${agent}/chat`} aria-label="Open chat">
            <MessageSquare className="size-4" />
          </Link>
        </Button>

        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        <ModuleNav />

        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Capped and centred: a module list stretched across a 2560px
              monitor is unreadable, and the PRD asks for work objects rather
              than a wall of full-bleed panels. */}
          <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </div>
        </main>

        <aside
          className={cn(
            "hidden min-h-0 shrink-0 border-l border-(--vq-line-2) bg-card lg:flex",
            dockOpen ? "w-[360px] xl:w-[400px]" : "w-0 overflow-hidden border-l-0",
          )}
          aria-hidden={!dockOpen}
        >
          {dockOpen && <ChatDock />}
        </aside>
      </div>
    </div>
  )
}

function HeaderExtras() {
  const { spec, agent, organizationId } = useAgentWorkspace()
  if (!spec.headerExtras?.length) return null
  return (
    <div className="flex shrink-0 items-center gap-2">
      {spec.headerExtras.map((Extra, i) => (
        <Suspense key={i} fallback={null}>
          <Extra agent={agent} organizationId={organizationId} />
        </Suspense>
      ))}
    </div>
  )
}
