"use client"

import { useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import type { IntegrationCatalogEntry } from "@repo/integrations-catalog"
import { useDisconnectMcp } from "@/lib/api/mcp"
import { ConnectIntegrationModal } from "./ConnectIntegrationModal"
import { IntegrationLogo } from "./IntegrationLogo"

// Kept so existing `import { IntegrationLogo } from ".../IntegrationCatalogCard"` still works.
export { IntegrationLogo }

const AGENT_LABEL: Record<string, string> = {
  vega: "Vega",
  maya: "Maya",
  sage: "Sage",
  scout: "Scout",
  rex: "Rex",
  lex: "Lex",
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
            <StatusPill key={agent} level="info" icon={null}>
              {AGENT_LABEL[agent] ?? agent}
            </StatusPill>
          ))}
        </div>
        <Button
          variant={connected ? "outline" : "default"}
          size="sm"
          onClick={connected ? handleDisconnect : () => setModalOpen(true)}
          disabled={!isConnectable || disconnect.isPending}
          title={!isConnectable ? "Coming soon" : undefined}
        >
          {disconnect.isPending ? "..." : connected ? "Disconnect" : isConnectable ? "Connect" : "Coming soon"}
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
