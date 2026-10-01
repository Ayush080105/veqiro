"use client"

import Link from "next/link"

import { MODULE_META } from "@/lib/workspace/modules"
import { cn } from "@/lib/utils"
import { useAgentWorkspace } from "./AgentWorkspaceContext"

/**
 * The module rail.
 *
 * Ready modules sit at the top; not-yet ones are grouped under a quiet "Coming
 * soon" heading rather than being listed as equal peers. Ten identical entries,
 * most of them empty, is the fastest way to make a workspace feel like a
 * directory of disappointments.
 */
export function ModuleNav() {
  return (
    <nav
      aria-label="Workspace modules"
      className="hidden w-52 shrink-0 overflow-y-auto border-r border-(--vq-line-2) bg-card px-2 py-3 md:block"
    >
      <ModuleNavList />
    </nav>
  )
}

/**
 * The module list itself, shared between the desktop rail and the mobile
 * sheet (`WorkspaceMobileNav`) so the two can never drift — same modules,
 * same order, same "coming soon" grouping.
 */
export function ModuleNavList({ onNavigate }: { onNavigate?: () => void }) {
  const { modules, activeModule, hrefFor } = useAgentWorkspace()

  const visible = modules.filter((m) => !m.hiddenInNav)
  const ready = visible.filter((m) => m.status === "ready")
  const soon = visible.filter((m) => m.status !== "ready")

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {ready.map((module) => (
          <NavItem
            key={module.id}
            href={hrefFor(module.id)}
            label={module.label ?? MODULE_META[module.id].label}
            icon={MODULE_META[module.id].icon}
            active={activeModule === module.id}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      {soon.length > 0 && (
        <>
          <p className="mt-4 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Coming soon
          </p>
          <ul className="flex flex-col gap-0.5">
            {soon.map((module) => (
              <NavItem
                key={module.id}
                href={hrefFor(module.id)}
                label={module.label ?? MODULE_META[module.id].label}
                icon={MODULE_META[module.id].icon}
                active={activeModule === module.id}
                muted
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  muted,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  muted?: boolean
  onNavigate?: () => void
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--vq-r-sm)] px-2 py-1.5 text-sm no-underline transition-colors",
          active
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          muted && !active && "opacity-70",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  )
}
