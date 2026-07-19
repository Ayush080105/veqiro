"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, XCircle, ExternalLink, UserCircle2, Search } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { authClient } from "@/lib/auth-client"
import {
  authorizeUrl,
  platformSlugToEnum,
  useDisconnectIntegration,
  useIntegrations,
  type SocialAccount,
  type SocialPlatformSlug,
} from "@/lib/api/integrations"
import { useMcpConnections } from "@/lib/api/mcp"
import { INTEGRATIONS_CATALOG, getIntegrationCategories } from "@repo/integrations-catalog"
import { IntegrationCatalogCard, IntegrationLogo } from "@/components/integrations/IntegrationCatalogCard"
import { LEGACY_MCP_SLUGS } from "@/lib/config/legacy-integrations"
import { qk } from "@/lib/query-keys"
import { PageHeader } from "@/components/ui/page-header"

// ─── Legacy (native) integrations — Gmail/Calendar and X/LinkedIn/Instagram
// still connect through their original mechanism (better-auth / the bespoke
// SocialAccount OAuth module) until the Smithery cutover for those specific
// rows is verified — see plan Rollout phases 2-3. Everything else below
// renders from the shared @repo/integrations-catalog through the uniform
// Smithery connect flow.

interface LegacyIntegrationDef {
  id: string
  name: string
  description: string
  requiredBy: string[]
  note?: string
  platformSlug?: SocialPlatformSlug
  useBetterAuth?: boolean
  logoUrl?: string
}

const LEGACY_INTEGRATIONS: LegacyIntegrationDef[] = [
  {
    id: "google",
    name: "Google (Gmail & Calendar)",
    description:
      "Required for Vega to read your inbox, draft replies, and manage calendar events on your behalf.",
    requiredBy: ["Vega"],
    useBetterAuth: true,
    logoUrl: "https://api.smithery.ai/servers/gmail/icon",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    description:
      "Publish Maya's drafts straight to X — tweets, threads, and posts with generated images.",
    requiredBy: ["Maya"],
    platformSlug: "twitter",
    logoUrl: "https://api.smithery.ai/servers/twitter/icon",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Share Maya's long-form posts and images directly to your personal LinkedIn feed.",
    requiredBy: ["Maya"],
    platformSlug: "linkedin",
    logoUrl: "https://logos.composio.dev/api/linkedin",
  },
  {
    id: "instagram",
    name: "Instagram",
    description:
      "Publish Maya's visual posts to an Instagram Business account linked to a Facebook Page.",
    note: "Requires a Professional account. To switch (it's free): ••• → Account type and tools → Account type → Switch to professional.",
    requiredBy: ["Maya"],
    platformSlug: "instagram",
    logoUrl: "https://cdn.jsdelivr.net/gh/ComposioHQ/open-logos@master/instagram.svg",
  },
]

const MCP_CATALOG = INTEGRATIONS_CATALOG.filter((e) => !LEGACY_MCP_SLUGS.has(e.slug))
const CATEGORIES = getIntegrationCategories().filter((c) =>
  MCP_CATALOG.some((e) => e.category === c)
)

// ─── Legacy Integration Card (unchanged) ───────────────────────────────────

function LegacyIntegrationCard({
  integration,
  account,
  connectedOverride,
  connectedEmail,
}: {
  integration: LegacyIntegrationDef
  account?: SocialAccount
  connectedOverride?: boolean
  connectedEmail?: string
}) {
  const disconnect = useDisconnectIntegration()
  const connected = connectedOverride ?? Boolean(account)
  const isWired = Boolean(integration.platformSlug) || Boolean(integration.useBetterAuth)
  const loading = disconnect.isPending

  const accountDisplay = account?.accountName ?? account?.providerAccountId ?? connectedEmail ?? null

  async function handleToggle() {
    if (!isWired) {
      toast.info(`${integration.name} integration isn't wired up yet.`)
      return
    }
    try {
      if (integration.useBetterAuth) {
        await authClient.signIn.social({
          provider: "google",
          callbackURL: `${window.location.origin}/settings/integrations?connected=google`,
        })
        return
      }
      if (connected && account) {
        await disconnect.mutateAsync(account.id)
        toast.success(`${integration.name} disconnected`)
      } else if (integration.platformSlug) {
        window.location.href = authorizeUrl(integration.platformSlug)
        return
      }
    } catch (err) {
      toast.error(
        `Failed to ${connected ? "disconnect" : "connect"} ${integration.name}: ${(err as Error).message}`
      )
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IntegrationLogo name={integration.name} logoUrl={integration.logoUrl} />
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm font-semibold">{integration.name}</CardTitle>
              <CardDescription>{integration.description}</CardDescription>
              {integration.note && (
                <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-relaxed">
                  {integration.note}
                </p>
              )}
            </div>
          </div>
          {connected ? (
            <CheckCircle2 className="size-4 shrink-0 text-chart-2 mt-0.5" />
          ) : (
            <XCircle className="size-4 shrink-0 text-muted-foreground/50 mt-0.5" />
          )}
        </div>
      </CardHeader>

      {connected && accountDisplay && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 rounded-md border border-chart-2/20 bg-chart-2/8 px-2.5 py-1.5">
            <UserCircle2 className="size-3.5 shrink-0 text-chart-2" />
            <span className="truncate text-[11px] font-medium text-foreground">{accountDisplay}</span>
          </div>
        </div>
      )}

      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1">
          {integration.requiredBy.map((agent) => (
            <Badge key={agent} variant="outline" className="text-[10px]">
              {agent}
            </Badge>
          ))}
        </div>
        <Button
          variant={connected ? "outline" : "default"}
          size="sm"
          onClick={handleToggle}
          disabled={loading || !isWired}
          title={!isWired ? "Coming soon" : undefined}
        >
          {loading ? "…" : connected ? "Disconnect" : isWired ? "Connect" : "Coming soon"}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: accounts = [] } = useIntegrations()
  const { data: mcpConnections = [] } = useMcpConnections()
  const [linkedProviders, setLinkedProviders] = useState<Set<string>>(new Set())
  const [googleEmail, setGoogleEmail] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")

  const refetchTrigger = searchParams.get("connected")
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [accountsResult, sessionResult] = await Promise.all([
          authClient.listAccounts(),
          authClient.getSession(),
        ])
        const list = (accountsResult?.data ?? []) as Array<{
          providerId?: string
          provider?: string
        }>
        const ids = new Set(list.map((a) => a.providerId ?? a.provider ?? "").filter(Boolean))
        if (!cancelled) {
          setLinkedProviders(ids)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const email = (sessionResult?.data as any)?.user?.email as string | undefined
          if (email) setGoogleEmail(email)
        }
      } catch {
        // Treat as not-linked; user can still click Connect.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refetchTrigger])

  useEffect(() => {
    const connected = searchParams.get("connected")
    const error = searchParams.get("error")
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase()}${connected.slice(1)} connected`)
      queryClient.invalidateQueries({ queryKey: qk.integrations() })
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

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MCP_CATALOG.filter((e) => {
      if (category !== "all" && e.category !== category) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
    })
  }, [search, category])

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="integrations"
        subtitle="Connect external tools to unlock the full power of your AI team."
        sticker={{ label: "plug it in", rot: -4, color: "var(--vq-yellow)" }}
      />

      <SettingsNav />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
          <p className="text-xs text-muted-foreground">
            Connect external tools to unlock the full power of your AI team.
          </p>
        </div>
        <a
          href="https://docs.veqiro.com/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Docs
          <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LEGACY_INTEGRATIONS.map((integration) => {
          const account = integration.platformSlug
            ? accountByPlatform.get(platformSlugToEnum[integration.platformSlug])
            : undefined
          const connectedOverride = integration.useBetterAuth
            ? linkedProviders.has(integration.id)
            : undefined
          return (
            <LegacyIntegrationCard
              key={integration.id}
              integration={integration}
              account={account}
              connectedOverride={connectedOverride}
              connectedEmail={integration.useBetterAuth ? googleEmail : undefined}
            />
          )
        })}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">1000+ more, via Smithery</h2>
          <p className="text-xs text-muted-foreground">
            Browse the full catalog and connect the tools each agent needs.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations…"
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
          {filteredCatalog.map((entry) => (
            <IntegrationCatalogCard
              key={entry.slug}
              entry={entry}
              connected={connectedMcpSlugs.has(entry.slug)}
            />
          ))}
        </div>

        {filteredCatalog.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No integrations match “{search}”.
          </p>
        )}
      </div>
    </div>
  )
}
