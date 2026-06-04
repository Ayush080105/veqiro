"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  FileText,
  Newspaper,
  Mail,
  Calendar,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Logo from "@/components/logo"
import { FONT } from "@/lib/fonts"
import { authClient } from "@/lib/auth-client"
import {
  clearActiveAndStartNew,
  switchToOrganization,
} from "@/lib/api/organizations"

const workspaceItems = [
  { href: "/workspace/briefing", label: "Briefing", icon: Newspaper },
  { href: "/workspace/inbox", label: "Inbox", icon: Mail },
  { href: "/workspace/calendar", label: "Calendar", icon: Calendar },
]

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistants", label: "Assistants", icon: Users },
]

const bottomNavItems = [
  { href: "/brain", label: "Brain", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
]

const monoLabelStyle: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
}

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3001"
const POST_LOGOUT_URL = LANDING_URL

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const { data: organizationList } = authClient.useListOrganizations()
  const organizations = organizationList ?? []
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const isWorkspaceActive = pathname.startsWith("/workspace")

  const switchOrg = async (organizationId: string) => {
    if (switchingId || organizationId === activeOrg?.id) return
    setSwitchingId(organizationId)
    await switchToOrganization(organizationId, router)
    setSwitchingId(null)
  }

  const createOrg = async () => {
    if (switchingId) return
    setSwitchingId("__new__")
    await clearActiveAndStartNew(router)
    setSwitchingId(null)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-4 py-3">
        <a
          href={LANDING_URL}
          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          title="Back to veqiro.com"
        >
          <Logo className="w-8 h-8 shrink-0" />
          <span
            className="group-data-[collapsible=icon]:hidden"
            style={{
              fontFamily: FONT.head,
              fontSize: 18,
              letterSpacing: -0.5,
              color: "#111",
            }}
          >
            veqiro
          </span>
        </a>
        {activeOrg && (
          <div className="group-data-[collapsible=icon]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left transition-transform active:translate-y-px"
                    style={{
                      padding: "6px 10px",
                      background: "#FFF9ED",
                      border: "2px solid #111",
                      borderRadius: 8,
                      boxShadow: "2px 2px 0 #111",
                      cursor: "pointer",
                    }}
                  />
                }
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#1DBC87",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    color: "#111",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {activeOrg.name}
                </span>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    border: "1.5px solid #111",
                    borderRadius: 999,
                    background: "#F5C518",
                    color: "#111",
                  }}
                >
                  Free
                </span>
                <ChevronDown className="size-3 text-foreground/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 border-2 border-foreground bg-white p-1 shadow-[4px_4px_0_#111]"
              >
                {organizations?.map((organization) => {
                  const isCurrent = organization.id === activeOrg.id
                  const isSwitching = switchingId === organization.id
                  return (
                    <DropdownMenuItem
                      key={organization.id}
                      disabled={isCurrent || !!switchingId}
                      onClick={() => void switchOrg(organization.id)}
                      className="flex-col items-start gap-1 rounded-md py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span
                          className="truncate"
                          style={{
                            fontFamily: FONT.head,
                            fontSize: 13,
                            color: "#111",
                          }}
                        >
                          {organization.name}
                        </span>
                        {isSwitching ? (
                          <Loader2 className="size-3.5 animate-spin text-foreground/70" />
                        ) : isCurrent ? (
                          <Check className="size-3.5 text-foreground/70" />
                        ) : null}
                      </div>
                      <span
                        className="truncate"
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: "#555",
                        }}
                      >
                        {organization.slug} /{" "}
                        {organization.onboarded ? "Onboarded" : "Setup needed"}
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator className="my-1 bg-foreground/20" />
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
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    Create workspace
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!!switchingId}
                  onClick={() => router.push("/workspaces")}
                  className="gap-2 rounded-md"
                >
                  <ArrowUpRight className="size-4" />
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    See all workspaces
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} style={monoLabelStyle} />}
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <SidebarMenuItem>
                <Collapsible defaultOpen={isWorkspaceActive}>
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        isActive={isWorkspaceActive}
                        style={monoLabelStyle}
                      />
                    }
                  >
                    <FileText className="size-4" />
                    <span>Workspace</span>
                    <ChevronDown className="ml-auto size-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {workspaceItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            render={
                              <Link
                                href={item.href}
                                style={{ ...monoLabelStyle, fontSize: 10 }}
                              />
                            }
                            isActive={pathname === item.href}
                          >
                            <item.icon className="size-3" />
                            <span>{item.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} style={monoLabelStyle} />}
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")
                    }
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3">
        <div
          className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
        >
          <div
            title={session?.user?.name ?? "User"}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#F5C518",
              border: "2px solid #111",
              boxShadow: "2px 2px 0 #111",
              display: "grid",
              placeItems: "center",
              fontFamily: FONT.head,
              fontSize: 13,
              color: "#111",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (session?.user?.name?.charAt(0)?.toUpperCase() ?? "U")
            )}
          </div>
          <div
            className="group-data-[collapsible=icon]:hidden"
            style={{ flex: 1, minWidth: 0 }}
          >
            <p
              style={{
                fontFamily: FONT.head,
                fontSize: 12,
                color: "#111",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session?.user?.name ?? "User"}
            </p>
            <p
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: "#555",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session?.user?.email}
            </p>
          </div>
          <button
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
            className="group-data-[collapsible=icon]:hidden"
            style={{
              background: "transparent",
              border: "none",
              color: "#555",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
