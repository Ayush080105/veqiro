"use client"

import { getIntegrationsByAgent } from "@repo/integrations-catalog"
import {
  useMcpConnections,
  useMcpToolPreference,
  useSetMcpToolPreference,
} from "@/lib/api/mcp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Which research source Scout should use.
 *
 * Scout's native research tools call their own default data source (Serper)
 * internally and cannot reliably be prompted to prefer a connected MCP tool
 * instead — see SUPERSEDABLE_BY_MCP in apps/ai/agents/base.py. This lets the
 * org override it explicitly rather than leaving it to the model.
 *
 * Moved verbatim from the old chat page, where it was the single hardcoded
 * Scout branch. In the workspace it arrives through Scout's spec as a chat
 * header extra, which is why the framework no longer needs to know Scout
 * exists.
 */
export function ScoutSearchSource() {
  const { data: connections } = useMcpConnections()
  const { data: preference } = useMcpToolPreference("scout")
  const setPreference = useSetMcpToolPreference("scout")

  const options = getIntegrationsByAgent("scout")
    .filter((entry) => entry.status === "composio")
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      connected:
        connections?.some((c) => c.slug === entry.slug && c.status === "CONNECTED") ?? false,
    }))
    .filter((entry) => entry.connected)

  // Nothing connected means there is no choice to offer.
  if (options.length === 0) return null

  const selectedSlug = options.some(
    (option) => option.slug === preference?.preferredIntegrationSlug,
  )
    ? preference!.preferredIntegrationSlug!
    : "__default"

  return (
    <Select
      value={selectedSlug}
      onValueChange={(value) =>
        setPreference.mutate(!value || value === "__default" ? null : String(value))
      }
      disabled={setPreference.isPending}
    >
      <SelectTrigger
        aria-label="Scout research source"
        title="Which research source Scout should use"
        className="h-7 w-24 shrink-0 rounded-md border-black/15 bg-transparent px-2 text-[11px] text-muted-foreground"
      >
        <SelectValue>
          {(value) => {
            if (!value || value === "__default") return "Default"
            return options.find((option) => option.slug === value)?.name ?? String(value)
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-36 rounded-md">
        <SelectItem value="__default">Default search</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.slug} value={option.slug}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
