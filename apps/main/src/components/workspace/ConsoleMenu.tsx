"use client"

import { useRouter } from "next/navigation"
import { ArrowUpRight, Check, LayoutGrid, Loader2, Plus } from "lucide-react"

import { CONSOLE_NAV } from "@/lib/config/console-nav"
import { useOrgSwitcher } from "@/lib/hooks/use-org-switcher"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * The way out of a full-screen workspace, to anywhere in the console.
 *
 * A workspace deliberately has no app sidebar, which used to leave "← Employees"
 * as the only exit: reaching Dashboard, Tasks, Brain, Settings or another
 * organization meant going out and then finding the sidebar. This is that
 * sidebar's destinations and organization switcher, on demand.
 */
export function ConsoleMenu() {
  const router = useRouter()
  const { activeOrg, organizations, switchingId, switchOrg, createOrg } = useOrgSwitcher()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 px-2 text-muted-foreground"
            aria-label="Console menu"
          />
        }
      >
        <LayoutGrid className="size-4" />
        <span className="hidden lg:inline">Console</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Console</DropdownMenuLabel>
          {[...CONSOLE_NAV.primary, ...CONSOLE_NAV.secondary].map((item) => (
            <DropdownMenuItem
              key={item.href}
              onClick={() => router.push(item.href)}
              className="gap-2.5 py-2.5"
            >
              <item.icon className="size-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        {activeOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{activeOrg.name}</DropdownMenuLabel>
              {organizations.map((organization) => {
                const isCurrent = organization.id === activeOrg.id
                const isSwitching = switchingId === organization.id
                return (
                  <DropdownMenuItem
                    key={organization.id}
                    disabled={isCurrent || !!switchingId}
                    onClick={() => void switchOrg(organization.id)}
                    className="justify-between gap-2 py-2.5"
                  >
                    <span className="truncate">{organization.name}</span>
                    {isSwitching ? (
                      <Loader2 className="size-3.5 animate-spin text-foreground/70" />
                    ) : isCurrent ? (
                      <Check className="size-3.5 text-foreground/70" />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuItem
                disabled={!!switchingId}
                onClick={() => void createOrg()}
                className="gap-2 py-2.5"
              >
                {switchingId === "__new__" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Create workspace
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!switchingId}
                onClick={() => router.push("/workspaces")}
                className="gap-2 py-2.5"
              >
                <ArrowUpRight className="size-4" />
                See all workspaces
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
