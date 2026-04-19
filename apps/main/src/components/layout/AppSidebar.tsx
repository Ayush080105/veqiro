"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  FileText,
  Newspaper,
  Users2,
  ChevronDown,
  LogOut,
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
import Logo from "@/components/logo"
import { FONT } from "@/components/veqiro/shared"
import { authClient } from "@/lib/auth-client"

const workspaceItems = [
  { href: "/workspace/briefing", label: "Briefing", icon: Newspaper },
  { href: "/workspace/content", label: "Content", icon: FileText },
  { href: "/workspace/leads", label: "Leads", icon: Users2 },
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
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"
const POST_LOGOUT_URL = LANDING_URL

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const isWorkspaceActive = pathname.startsWith("/workspace")

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-4 py-3">
        <a
          href={LANDING_URL}
          className="flex items-center gap-2"
          title="Back to veqiro.com"
        >
          <Logo className="w-8 h-8" />
          <span
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "#FFF9ED",
              border: "2px solid #111",
              borderRadius: 8,
              boxShadow: "2px 2px 0 #111",
            }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
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
          <div style={{ flex: 1, minWidth: 0 }}>
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
