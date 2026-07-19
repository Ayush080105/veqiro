"use client"

import Link from "next/link"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getIntegrationsByAgent, type AgentSlug } from "@repo/integrations-catalog"
import { IntegrationCatalogCard } from "@/components/integrations/IntegrationCatalogCard"
import { LEGACY_MCP_SLUGS } from "@/lib/config/legacy-integrations"
import { useMcpConnections } from "@/lib/api/mcp"

interface OnboardMeModalProps {
  agentSlug: AgentSlug
  agentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OnboardMeModal({ agentSlug, agentName, open, onOpenChange }: OnboardMeModalProps) {
  const { data: mcpConnections = [] } = useMcpConnections()
  const connectedSlugs = new Set(
    mcpConnections.filter((c) => c.status === "CONNECTED").map((c) => c.slug)
  )
  const integrations = getIntegrationsByAgent(agentSlug).filter((e) => !LEGACY_MCP_SLUGS.has(e.slug))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onboard {agentName}</DialogTitle>
          <DialogDescription>
            Connect the tools {agentName} needs to actually do its job, not just talk about it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {integrations.map((entry) => (
            <IntegrationCatalogCard key={entry.slug} entry={entry} connected={connectedSlugs.has(entry.slug)} />
          ))}
          {integrations.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No additional integrations for {agentName} yet.
            </p>
          )}
        </div>

        <Link
          href="/settings/integrations"
          className="text-center text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Manage all in Settings →
        </Link>
      </DialogContent>
    </Dialog>
  )
}
