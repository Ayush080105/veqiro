"use client"

import { Suspense, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react"

import { AGENT_PHOTOS } from "@/lib/config/agents"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAgentWorkspace } from "./AgentWorkspaceContext"
import { useWorkspaceChat } from "./WorkspaceChatProvider"
import { ModuleNav } from "./ModuleNav"
import { ChatDock } from "./chat/ChatDock"

/**
 * The workspace frame: identity header, module nav, module body, chat dock.
 *
 * Nav and dock are panels — a border and a background, no card chrome. The
 * design system bans nested cards and this is already three levels deep
 * (nav | body | dock) before a module renders its own cards inside the body.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { agent, config } = useAgentWorkspace()
  const { dockOpen, toggleDock } = useWorkspaceChat()
  const photo = AGENT_PHOTOS[agent]

  return (
    <div className="flex h-[calc(100svh-56px)] min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-(--vq-line-2) bg-card px-4 py-3">
        <span
          className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border"
          style={{ background: config.color }}
        >
          {photo ? (
            <Image src={photo} alt={config.name} fill sizes="36px" className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-head text-xs text-white">
              {config.initials}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-head text-base leading-tight">{config.name}</h1>
          {/* Role, not a feature list — the point is that this is an employee. */}
          <p className="truncate text-xs text-muted-foreground">{config.role}</p>
        </div>

        <HeaderExtras />

        <Button
          variant="outline"
          size="sm"
          onClick={toggleDock}
          className="hidden shrink-0 gap-1.5 lg:inline-flex"
          aria-label={dockOpen ? "Hide chat" : "Show chat"}
        >
          {dockOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
          Chat
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5 lg:hidden">
          <Link href={`/workspace/${agent}/chat`} aria-label="Open chat">
            <MessageSquare className="size-4" />
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <ModuleNav />

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</main>

        <aside
          className={cn(
            "hidden min-h-0 shrink-0 border-l border-(--vq-line-2) bg-card lg:flex",
            dockOpen ? "w-[380px] xl:w-[420px]" : "w-0 overflow-hidden border-l-0",
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
