"use client"

import { useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { IntegrationCatalogEntry } from "@repo/integrations-catalog"
import { useDisconnectMcp } from "@/lib/api/mcp"
import { ConnectIntegrationModal } from "./ConnectIntegrationModal"

const AGENT_LABEL: Record<string, string> = {
  vega: "Vega",
  maya: "Maya",
  sage: "Sage",
  scout: "Scout",
  rex: "Rex",
  lex: "Lex",
}

/**
 * logoUrl comes from a mix of sources (Composio's logo API, jsdelivr-hosted
 * open logos, favicon fallbacks — real brand icons, already colored), so
 * this renders as a plain <img>, not a CSS mask. Falls back to a two-letter
 * initials badge if there's no URL, or if the image fails to load (external
 * hosts we don't control).
 */
export function IntegrationLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (!logoUrl || failed) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable third-party logo hosts
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className="size-8 shrink-0 rounded-md object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export function IntegrationCatalogCard({
  entry,
  connected,
}: {
  entry: IntegrationCatalogEntry
  connected: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const disconnect = useDisconnectMcp(entry.slug)
  const isConnectable = entry.status === "composio"

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync()
      toast.success(`${entry.name} disconnected`)
    } catch (err) {
      toast.error(`Failed to disconnect ${entry.name}: ${(err as Error).message}`)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IntegrationLogo name={entry.name} logoUrl={entry.logoUrl} />
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-sm font-semibold">{entry.name}</CardTitle>
              <CardDescription>{entry.description}</CardDescription>
            </div>
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
          {entry.agents.map((agent) => (
            <Badge key={agent} variant="outline" className="text-[10px]">
              {AGENT_LABEL[agent] ?? agent}
            </Badge>
          ))}
        </div>
        <Button
          variant={connected ? "outline" : "default"}
          size="sm"
          onClick={connected ? handleDisconnect : () => setModalOpen(true)}
          disabled={!isConnectable || disconnect.isPending}
          title={!isConnectable ? "Coming soon" : undefined}
        >
          {disconnect.isPending ? "…" : connected ? "Disconnect" : isConnectable ? "Connect" : "Coming soon"}
        </Button>
      </CardContent>

      <ConnectIntegrationModal
        slug={entry.slug}
        name={entry.name}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </Card>
  )
}
