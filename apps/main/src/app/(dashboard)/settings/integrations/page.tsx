"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { qk } from "@/lib/query-keys"
import { PageHeader } from "@/components/ui/page-header"

// ─── Integration Config ───────────────────────────────────────────────────────

interface IntegrationDef {
  id: string
  name: string
  description: string
  requiredBy: string[]
  docsUrl?: string
  /** If set, this integration is wired to /api/v1/integrations/:slug */
  platformSlug?: SocialPlatformSlug
  /** If true, this integration uses Better Auth's social sign-in for OAuth */
  useBetterAuth?: boolean
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "google",
    name: "Google (Gmail & Calendar)",
    description:
      "Required for Vega to read your inbox, draft replies, and manage calendar events on your behalf.",
    requiredBy: ["Vega"],
    useBetterAuth: true,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    description:
      "Publish Maya's drafts straight to X — tweets, threads, and posts with generated images.",
    requiredBy: ["Maya"],
    platformSlug: "twitter",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Share Maya's long-form posts and images directly to your personal LinkedIn feed.",
    requiredBy: ["Maya"],
    platformSlug: "linkedin",
  },
  {
    id: "instagram",
    name: "Instagram",
    description:
      "Publish Maya's visual posts to an Instagram Business account linked to a Facebook Page.",
    requiredBy: ["Maya"],
    platformSlug: "instagram",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Send briefing summaries and agent updates directly to your Slack channels.",
    requiredBy: ["Vega", "Rex"],
  },
  {
    id: "notion",
    name: "Notion",
    description:
      "Sync generated content drafts and research reports to your Notion workspace.",
    requiredBy: ["Sage", "Maya"],
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "Allow Lex and Scout to monitor your repositories for compliance and dependency updates.",
    requiredBy: ["Lex", "Scout"],
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Rex reads your MRR, churn, and revenue metrics directly from Stripe for financial briefings.",
    requiredBy: ["Rex"],
  },
]

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  account,
  connectedOverride,
}: {
  integration: IntegrationDef
  account?: SocialAccount
  /** For useBetterAuth integrations (Google), connection state lives in
   * Better Auth's `account` table, not the `social_account` table that
   * `account` here points at. The parent computes that and passes it in. */
  connectedOverride?: boolean
}) {
  const disconnect = useDisconnectIntegration()
  const connected = connectedOverride ?? Boolean(account)
  const isWired = Boolean(integration.platformSlug) || Boolean(integration.useBetterAuth)
  const loading = disconnect.isPending

  async function handleToggle() {
    if (!isWired) {
      toast.info(`${integration.name} integration isn't wired up yet.`)
      return
    }
    try {
      if (integration.useBetterAuth) {
        // Use an absolute URL so Better Auth doesn't resolve this against its
        // own baseURL (the server origin) and bounce the user to port 5000.
        // window.location.origin is the dashboard's own origin since this
        // click can only happen here.
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
        `Failed to ${connected ? "disconnect" : "connect"} ${integration.name}: ${
          (err as Error).message
        }`
      )
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold">{integration.name}</CardTitle>
            <CardDescription>{integration.description}</CardDescription>
          </div>
          {connected ? (
            <CheckCircle2 className="size-4 shrink-0 text-chart-2 mt-0.5" />
          ) : (
            <XCircle className="size-4 shrink-0 text-muted-foreground/50 mt-0.5" />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1">
          {integration.requiredBy.map((agent) => (
            <Badge key={agent} variant="outline" className="text-[10px]">
              {agent}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected && account?.accountName && (
            <Badge variant="secondary" className="text-[10px]">
              {account.accountName}
            </Badge>
          )}
          <Button
            variant={connected ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={loading || !isWired}
            title={!isWired ? "Coming soon" : undefined}
          >
            {loading ? "…" : connected ? "Disconnect" : isWired ? "Connect" : "Coming soon"}
          </Button>
        </div>
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
  const [linkedProviders, setLinkedProviders] = useState<Set<string>>(new Set())

  // Better Auth's listAccounts returns the user's linked OAuth providers
  // (e.g. "google"). Polled on mount and after every connect/disconnect
  // round-trip so the UI stays in sync without a hard refresh.
  const refetchTrigger = searchParams.get("connected")
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await authClient.listAccounts()
        const list = (result?.data ?? []) as Array<{
          providerId?: string
          provider?: string
        }>
        const ids = new Set(
          list.map((a) => a.providerId ?? a.provider ?? "").filter(Boolean)
        )
        if (!cancelled) setLinkedProviders(ids)
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
        {INTEGRATIONS.map((integration) => {
          const account = integration.platformSlug
            ? accountByPlatform.get(platformSlugToEnum[integration.platformSlug])
            : undefined
          // Map our `id` to the Better Auth provider id. Today only Google
          // uses this path, but we route through `id` so adding GitHub /
          // Microsoft etc. later is a one-line change.
          const connectedOverride = integration.useBetterAuth
            ? linkedProviders.has(integration.id)
            : undefined
          return (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              account={account}
              connectedOverride={connectedOverride}
            />
          )
        })}
      </div>
    </div>
  )
}
