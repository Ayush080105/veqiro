"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  LogOut,
  Plus,
  Check,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { CONSOLE_NAV } from "@/lib/config/console-nav"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import { useOrgSwitcher } from "@/lib/hooks/use-org-switcher"
import { useBillingStatus } from "@/lib/api/billing"
import { orgPlanLabel } from "@/lib/billing/org-plan"

const navItems = CONSOLE_NAV.primary
const bottomNavItems = CONSOLE_NAV.secondary

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"
const POST_LOGOUT_URL = LANDING_URL

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const { data: session } = authClient.useSession()
  const hydrated = useHydrated()
  const visibleSession = hydrated ? session : null

  // A mobile sidebar is a temporary sheet, so navigation should dismiss it.
  // The pathname effect also covers programmatic navigation from workspace
  // actions; the click handler covers selecting the route already on screen.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  const closeMobileSidebar = () => setOpenMobile(false)

  const {
    activeOrg: visibleActiveOrg,
    organizations,
    switchingId,
    switchOrg,
    createOrg,
  } = useOrgSwitcher(closeMobileSidebar)

  // Derived from what the organization actually holds; absent when it holds
  // nothing. (This badge was a hardcoded "Free" for everyone.)
  const { data: billing } = useBillingStatus(visibleActiveOrg?.id)
  const planLabel = orgPlanLabel(billing?.subscription?.entitlements)

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3 px-3 pt-3 pb-4">
        <a
          href={LANDING_URL}
          onClick={closeMobileSidebar}
          className="flex h-9 items-center group-data-[collapsible=icon]:justify-center"
          title="Back to veqiro.com"
        >
          {/* Full logo when sidebar is expanded. logo.png's wordmark is dark ink
              and disappears on the dark sidebar, so dark mode gets the mark plus a
              text wordmark instead — the same lockup the sign-in screen uses. */}
          <span className="group-data-[collapsible=icon]:hidden">
            <Image
              src="/logo.png"
              alt="Veqiro"
              width={110}
              height={28}
              className="object-contain dark:hidden"
              priority
            />
            <span className="hidden items-center gap-2 dark:flex">
              <Image
                src="/icon.png"
                alt=""
                width={28}
                height={28}
                className="shrink-0 rounded-lg"
                priority
              />
              <span className="font-head text-xl leading-none tracking-tight text-foreground">
                veqiro
              </span>
            </span>
          </span>
          {/* Icon-only mark when sidebar is collapsed */}
          <Image
            src="/icon.png"
            alt="Veqiro"
            width={32}
            height={32}
            className="hidden shrink-0 rounded-lg group-data-[collapsible=icon]:block"
            priority
          />
        </a>
        {visibleActiveOrg && (
          <div className="group-data-[collapsible=icon]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-[var(--vq-r-sm)] border border-sidebar-border bg-card px-2.5 text-left shadow-[var(--vq-shadow-sm)] transition-[background-color,box-shadow,transform] hover:bg-sidebar-accent active:translate-y-px"
                  />
                }
              >
                <span className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {visibleActiveOrg.name}
                </span>
                {planLabel && (
                  <span className="rounded-full border border-sidebar-border bg-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-accent-foreground">
                    {planLabel}
                  </span>
                )}
                <ChevronDown className="size-3 text-foreground/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 p-1">
                {organizations?.map((organization) => {
                  const isCurrent = organization.id === visibleActiveOrg.id
                  const isSwitching = switchingId === organization.id
                  return (
                    <DropdownMenuItem
                      key={organization.id}
                      disabled={isCurrent || !!switchingId}
                      onClick={() => void switchOrg(organization.id)}
                      className="flex-col items-start gap-1 rounded-md py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {organization.name}
                        </span>
                        {isSwitching ? (
                          <Loader2 className="size-3.5 animate-spin text-foreground/70" />
                        ) : isCurrent ? (
                          <Check className="size-3.5 text-foreground/70" />
                        ) : null}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {organization.slug} /{" "}
                        {organization.onboarded ? "Onboarded" : "Setup needed"}
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  disabled={!!switchingId}
                  onClick={() => void createOrg()}
                  className="gap-2 rounded-md"
                >
                  {switchingId === "__new__" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  <span className="text-xs font-medium">Create workspace</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!!switchingId}
                  onClick={() => {
                    closeMobileSidebar()
                    router.push("/workspaces")
                  }}
                  className="gap-2 rounded-md"
                >
                  <ArrowUpRight className="size-4" />
                  <span className="text-xs font-medium">See all workspaces</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem
                  key={item.href}
                  data-tour={`nav-${item.href.replace("/", "")}`}
                >
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeMobileSidebar} />}
                    tooltip={item.label}
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  >
                    <item.icon className="size-4" />
                    <span className="font-body">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavItems.map((item) => (
                <SidebarMenuItem
                  key={item.href}
                  data-tour={`nav-${item.href.replace("/", "")}`}
                >
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={closeMobileSidebar} />}
                    tooltip={item.label}
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  >
                    <item.icon className="size-4" />
                    <span className="font-body">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-[var(--vq-r-sm)] px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <div
            title={visibleSession?.user?.name ?? "User"}
            className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-sidebar-border bg-accent text-sm font-semibold text-accent-foreground shadow-[var(--vq-shadow-sm)]"
          >
            {visibleSession?.user?.image ? (
              // OAuth avatar hosts are user/provider controlled and cannot be
              // safely enumerated in Next Image's remote allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={visibleSession.user.image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (visibleSession?.user?.name?.charAt(0)?.toUpperCase() ?? "U")
            )}
          </div>
          <div
            className="group-data-[collapsible=icon]:hidden"
            style={{ flex: 1, minWidth: 0 }}
          >
            <p className="m-0 truncate text-xs font-medium text-foreground">
              {visibleSession?.user?.name ?? "User"}
            </p>
            <p className="m-0 truncate text-[11px] text-muted-foreground">
              {visibleSession?.user?.email}
            </p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() =>
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    window.location.href = POST_LOGOUT_URL
                  },
                },
              })
            }
            title="Sign out"
            className="grid size-8 shrink-0 place-items-center rounded-[var(--vq-r-sm)] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
