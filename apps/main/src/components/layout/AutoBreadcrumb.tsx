"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getAgent } from "@/lib/config/agents"
import { Fragment } from "react"

const LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/assistants": "Assistants",
  "/brain": "Brain",
  "/settings": "Settings",
  "/settings/billing": "Billing",
  "/settings/integrations": "Integrations",
  "/settings/members": "Members",
  "/settings/notifications": "Notifications",
  "/workspace/content": "Content",
  "/workspace/leads": "Leads",
}

// `/workspace` is just a grouping prefix (briefing/calendar/content/inbox/leads
// all live under it) — it isn't a page a user thinks of as a destination, so
// it's dropped from the trail entirely rather than shown as a crumb.
const HIDDEN_SEGMENTS = new Set(["/workspace"])

function titleCase(segment: string): string {
  return segment
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ")
}

function resolveLabel(segment: string, href: string, parents: string[]): string {
  if (parents[0] === "assistants" && parents.length === 1) {
    return getAgent(segment)?.name ?? titleCase(segment)
  }
  return LABELS[href] ?? titleCase(segment)
}

export function AutoBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments
    .map((segment, i) => {
      const href = "/" + segments.slice(0, i + 1).join("/")
      const parents = segments.slice(0, i)
      return { segment, href, label: resolveLabel(segment, href, parents) }
    })
    .filter((crumb) => !HIDDEN_SEGMENTS.has(crumb.href))

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
