"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ShieldCheck, Trash2 } from "lucide-react"
import { getIntegrationBySlug } from "@repo/integrations-catalog"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { qk } from "@/lib/query-keys"
import {
  useApprovalPolicies,
  useMcpConnections,
  setApprovalPolicy,
  deleteApprovalPolicy,
  type McpApprovalMode,
} from "@/lib/api/mcp"

const MODE_LABELS: Record<McpApprovalMode, string> = {
  ALWAYS_ASK: "Ask me first",
  AUTO_RUN: "Do it automatically",
  NEVER: "Never allow",
}

const MODE_HELP: Record<McpApprovalMode, string> = {
  ALWAYS_ASK: "Nothing happens until you approve it. This is the default.",
  AUTO_RUN: "Runs without asking. Still recorded in your activity log.",
  NEVER: "Refused outright, and the attempt is recorded.",
}

/**
 * Rules for whether an agent's proposed change needs a human.
 *
 * Absence of a rule means "ask me" — the default the whole product rests on —
 * so this list starts empty and every row in it is a deliberate relaxation the
 * owner chose. Rows read as sentences rather than a policy matrix, because the
 * person setting them is the business owner, not an administrator.
 */
export function ApprovalPolicySection() {
  const { data: policies = [], isLoading } = useApprovalPolicies()
  const { data: connections = [] } = useMcpConnections()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [draftSlug, setDraftSlug] = useState<string>("*")
  const [draftMode, setDraftMode] = useState<McpApprovalMode>("ALWAYS_ASK")

  const connected = connections.filter((c) => c.status === "CONNECTED")
  const displayName = (slug: string) => getIntegrationBySlug(slug)?.name ?? slug

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.mcpApprovalPolicies() })

  const handleAdd = async () => {
    setBusy(true)
    try {
      await setApprovalPolicy({
        integrationSlug: draftSlug === "*" ? undefined : draftSlug,
        mode: draftMode,
      })
      toast.success("Rule saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that rule")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    try {
      await deleteApprovalPolicy(id)
      toast.success("Rule removed — back to asking you first")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that rule")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">When agents change something</h2>
        <p className="text-xs text-muted-foreground">
          By default every change waits for your approval. Add a rule here to
          relax that for a tool you trust, or to block one outright.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {policies.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5">
              <ShieldCheck className="size-3.5 shrink-0 text-chart-2" />
              <p className="text-[11px] text-muted-foreground">
                No rules. Every change asks you first.
              </p>
            </div>
          ) : (
            policies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">
                      {policy.integrationSlug === "*"
                        ? "Every tool"
                        : displayName(policy.integrationSlug)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {MODE_LABELS[policy.mode]}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{MODE_HELP[policy.mode]}</p>
                </div>
                <button
                  onClick={() => handleDelete(policy.id)}
                  disabled={busy}
                  aria-label="Remove rule"
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#D4C9B0] px-3 py-2.5 sm:flex-row sm:items-center">
            <Select value={draftSlug} onValueChange={(v) => setDraftSlug(v ?? "*")}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Which tool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">Every tool</SelectItem>
                {connected.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {displayName(c.slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={draftMode}
              onValueChange={(v) => setDraftMode((v as McpApprovalMode) ?? "ALWAYS_ASK")}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="What should happen" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as McpApprovalMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={handleAdd}
              disabled={busy}
              className="rounded-md border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-1.5 text-xs font-medium hover:bg-[#EFE7D6] transition-colors disabled:opacity-60"
            >
              Add rule
            </button>
          </div>

          {draftMode === "AUTO_RUN" && (
            <p className="text-[11px] text-muted-foreground">
              Worth knowing: if you also let agents act on their own, this
              combination means things can be sent with nobody watching.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
