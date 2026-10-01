"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Search, Plug } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApprovalPolicySection } from "@/components/settings/ApprovalPolicySection"
import { SettingsNav } from "@/components/settings/SettingsNav"
import {
  platformSlugToEnum,
  useIntegrations,
  type SocialAccount,
} from "@/lib/api/integrations"
import { useMcpConnections } from "@/lib/api/mcp"
import { INTEGRATIONS_CATALOG, getIntegrationCategories } from "@repo/integrations-catalog"
import { IntegrationCatalogCard } from "@/components/integrations/IntegrationCatalogCard"
import {
  LEGACY_INTEGRATIONS,
  LegacyIntegrationCard,
} from "@/components/integrations/LegacyIntegrationCard"
import { LEGACY_MCP_SLUGS } from "@/lib/config/legacy-integrations"
import { qk } from "@/lib/query-keys"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"

const MCP_CATALOG = INTEGRATIONS_CATALOG.filter((e) => !LEGACY_MCP_SLUGS.has(e.slug))
const CATEGORIES = getIntegrationCategories().filter((c) =>
  MCP_CATALOG.some((e) => e.category === c)
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: accounts = [] } = useIntegrations()
  const { data: mcpConnections = [] } = useMcpConnections()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")

  useEffect(() => {
    const connected = searchParams.get("connected")
    const error = searchParams.get("error")
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase()}${connected.slice(1)} connected`)
      queryClient.invalidateQueries({ queryKey: qk.integrations() })
      queryClient.invalidateQueries({ queryKey: qk.dashboardIntegrationHealth() })
      router.replace("/settings/integrations")
    } else if (error) {
      toast.error(`Connection failed: ${error}`)
      router.replace("/settings/integrations")
    }
  }, [searchParams, router, queryClient])

  const accountByPlatform = useMemo(() => {
    const map = new Map<string, SocialAccount>()
    for (const a of accounts) map.set(a.platform, a)
    return map
  }, [accounts])

  const connectedMcpSlugs = useMemo(
    () => new Set(mcpConnections.filter((c) => c.status === "CONNECTED").map((c) => c.slug)),
    [mcpConnections]
  )

  const connectedLegacy = useMemo(
    () =>
      LEGACY_INTEGRATIONS.filter((integration) =>
        integration.platformSlug
          ? accountByPlatform.has(platformSlugToEnum[integration.platformSlug])
          : false
      ),
    [accountByPlatform]
  )

  const disconnectedLegacy = useMemo(
    () =>
      LEGACY_INTEGRATIONS.filter((integration) =>
        integration.platformSlug
          ? !accountByPlatform.has(platformSlugToEnum[integration.platformSlug])
          : true
      ),
    [accountByPlatform]
  )

  const connectedCatalog = useMemo(
    () => MCP_CATALOG.filter((entry) => connectedMcpSlugs.has(entry.slug)),
    [connectedMcpSlugs]
  )

  const filteredDisconnectedCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MCP_CATALOG.filter((e) => {
      if (connectedMcpSlugs.has(e.slug)) return false
      if (category !== "all" && e.category !== category) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
    })
  }, [search, category, connectedMcpSlugs])

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title="Integrations"
        subtitle="Connect external tools to unlock the full power of your AI team."
      />

      <SettingsNav />

      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">Connected</h2>
            <p className="text-xs text-muted-foreground">
              Tools your agents can use right now.
            </p>
          </div>
          <a
            href="https://docs.veqiro.com/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
            <ExternalLink className="size-3" />
          </a>
        </div>

        {connectedLegacy.length + connectedCatalog.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {connectedLegacy.map((integration) => {
              const account = integration.platformSlug
                ? accountByPlatform.get(platformSlugToEnum[integration.platformSlug])
                : undefined
              return (
                <LegacyIntegrationCard
                  key={`legacy-${integration.id}`}
                  integration={integration}
                  account={account}
                />
              )
            })}
            {connectedCatalog.map((entry) => (
              <IntegrationCatalogCard key={entry.slug} entry={entry} connected />
            ))}
          </div>
        ) : (
          <EmptyState
            tone="plain"
            className="rounded-[var(--vq-r)] border border-border bg-card"
            icon={<Plug />}
            title="No integrations connected"
            description="Choose one below to give your agents a tool they can use."
          />
        )}
      </section>

      <ApprovalPolicySection />

      <section className="flex flex-col gap-3 pt-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">Not connected</h2>
          <p className="text-xs text-muted-foreground">
            Browse and connect more integrations your agents can use.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="pl-8"
            />
          </div>
          <Select value={category} onValueChange={(value) => setCategory(value ?? "all")}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {disconnectedLegacy.map((integration) => (
            <LegacyIntegrationCard
              key={`legacy-${integration.id}`}
              integration={integration}
            />
          ))}
          {filteredDisconnectedCatalog.map((entry) => (
            <IntegrationCatalogCard
              key={entry.slug}
              entry={entry}
              connected={false}
            />
          ))}
        </div>

        {disconnectedLegacy.length + filteredDisconnectedCatalog.length === 0 && (
          <EmptyState
            tone="plain"
            icon={<Search />}
            title="No matching integrations"
            description={`Nothing matched "${search}". Try a different name or category.`}
          />
        )}
      </section>
    </div>
  )
}
