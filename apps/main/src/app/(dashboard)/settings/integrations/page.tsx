"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { PageHeader } from "@/components/veqiro/shared"

// ─── Integration Config ───────────────────────────────────────────────────────

interface IntegrationDef {
  id: string
  name: string
  description: string
  requiredBy: string[]
  connected: boolean
  connectedAt?: string
  docsUrl?: string
}

// TODO: Replace with GET /api/v1/integrations?organizationId=xxx
const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "google",
    name: "Google (Gmail & Calendar)",
    description:
      "Required for Vega to read your inbox, draft replies, and manage calendar events on your behalf.",
    requiredBy: ["Vega"],
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Send briefing summaries and agent updates directly to your Slack channels.",
    requiredBy: ["Vega", "Rex"],
    connected: false,
  },
  {
    id: "notion",
    name: "Notion",
    description:
      "Sync generated content drafts and research reports to your Notion workspace.",
    requiredBy: ["Sage", "Maya"],
    connected: false,
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "Allow Lex and Scout to monitor your repositories for compliance and dependency updates.",
    requiredBy: ["Lex", "Scout"],
    connected: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Rex reads your MRR, churn, and revenue metrics directly from Stripe for financial briefings.",
    requiredBy: ["Rex"],
    connected: false,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    description:
      "Post and schedule content directly from the Content Hub without leaving Veqiro.",
    requiredBy: ["Maya"],
    connected: false,
  },
]

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({ integration }: { integration: IntegrationDef }) {
  const [connected, setConnected] = useState(integration.connected)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      if (connected) {
        // TODO: DELETE /api/v1/integrations/:id  Body: { organizationId }
        await new Promise((r) => setTimeout(r, 600))
        setConnected(false)
        toast.success(`${integration.name} disconnected`)
      } else {
        if (integration.id === "google") {
          // Google uses Better Auth OAuth flow
          // TODO: authClient.signIn.social({ provider: "google", scopes: ["gmail", "calendar"] })
          await new Promise((r) => setTimeout(r, 600))
        } else {
          // TODO: POST /api/v1/integrations/:id/connect  — opens OAuth flow
          await new Promise((r) => setTimeout(r, 600))
        }
        setConnected(true)
        toast.success(`${integration.name} connected`)
      }
    } catch {
      toast.error(`Failed to ${connected ? "disconnect" : "connect"} ${integration.name}`)
    } finally {
      setLoading(false)
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
          {connected && (
            <Badge variant="secondary" className="text-[10px]">
              Connected
            </Badge>
          )}
          <Button
            variant={connected ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? "…" : connected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
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
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
    </div>
  )
}
