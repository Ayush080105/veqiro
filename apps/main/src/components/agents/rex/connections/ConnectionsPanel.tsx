"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Link2, Loader2, MoreHorizontal, Plug, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import {
  HUBSPOT_ERROR_COPY, useConnections, useDisconnect, useHubspotReturn, useSyncConnection, type Connection,
} from "@/lib/api/rexConnections"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { ConnectHubSpotDialog, type WizardStep } from "./ConnectHubSpotDialog"
import { GuideButton, HubSpotGuideDialog } from "./HubSpotGuide"

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "not yet")

function StatusChip({ c }: { c: Connection }) {
  if (c.status === "auth_error") return <StatusPill level="danger">Needs reconnecting</StatusPill>
  if (c.status === "paused") return <StatusPill level="warn">Paused</StatusPill>
  if (c.datasets.some((d) => d.syncing)) return <StatusPill level="info" icon={<Loader2 className="animate-spin" />}>Syncing</StatusPill>
  if (c.datasets.some((d) => d.syncError)) return <StatusPill level="warn">Needs attention</StatusPill>
  return <StatusPill level="ok">Live</StatusPill>
}

/**
 * HubSpot connections for this workspace: what is connected, whether it is healthy, and the few
 * things a person needs to do to it. Also the home of the "Connect HubSpot" button and the place
 * the browser lands after HubSpot's consent screen.
 */
export function ConnectionsPanel({ className }: { className?: string }) {
  const { data, isLoading } = useConnections()
  const sync = useSyncConnection()
  const disconnect = useDisconnect()
  const returned = useHubspotReturn()

  const [wizard, setWizard] = React.useState<{ connectionId?: string; step: WizardStep } | null>(null)
  const [guide, setGuide] = React.useState(false)
  const [removing, setRemoving] = React.useState<Connection | null>(null)
  const [removeMode, setRemoveMode] = React.useState<"keep" | "delete">("keep")

  React.useEffect(() => {
    if (!returned) return
    if (returned.status === "connected" && returned.connectionId) setWizard({ connectionId: returned.connectionId, step: "verify" })
    else toast.error(HUBSPOT_ERROR_COPY[returned.reason ?? ""] ?? "HubSpot wasn't connected.")
  }, [returned])

  const runSync = (c: Connection, mode: "auto" | "full") =>
    sync.mutate({ connectionId: c.id, mode }, {
      onSuccess: () => toast.success(mode === "full" ? "Full resync started" : "Syncing now"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't start the sync"),
    })

  const connections = data?.connections ?? []

  return (
    <section className={cn("flex flex-col gap-2", className)} aria-label="HubSpot connections">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium">Live data sources <GuideButton onClick={() => setGuide(true)} /></p>
        <Button size="sm" variant="outline" onClick={() => setWizard({ step: "connect" })}>
          <Plug className="size-3.5" /> Connect HubSpot
        </Button>
      </div>

      {isLoading ? null : connections.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Connect HubSpot to build dashboards from your deals, companies, contacts and tickets. They update on their own while you work.{" "}
          <button type="button" onClick={() => setGuide(true)} className="text-foreground underline-offset-2 hover:underline">How does this work?</button>
        </p>
      ) : (
        connections.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-muted/10">
            <div className="flex items-center gap-2 px-3 py-2">
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{c.accountLabel ?? "HubSpot"}</p>
                <p className="text-[11px] text-muted-foreground">{c.authType === "oauth" ? "Connected with HubSpot" : "Connected with a key"}</p>
              </div>
              <StatusChip c={c} />
              <Button
                size="sm" variant="outline" disabled={sync.isPending || c.status !== "active"}
                onClick={() => runSync(c, "auto")}
              >
                <RefreshCw className={cn("size-3.5", sync.isPending && "animate-spin")} /> Sync now
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="More actions" />}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setWizard({ connectionId: c.id, step: "choose" })}>Change what&apos;s included</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runSync(c, "full")} disabled={c.status !== "active"}>Full resync</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setWizard({ connectionId: c.id, step: "connect" })}>Reconnect with a new key</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRemoveMode("keep"); setRemoving(c) }} className="text-destructive">Disconnect</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {c.status === "auth_error" && (
              <div className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <p className="flex-1">
                  {c.lastError ?? "HubSpot rejected this connection."} Your dashboards keep showing the last data until you reconnect.
                </p>
                <Button size="xs" onClick={() => setWizard({ connectionId: c.id, step: "connect" })}>Reconnect</Button>
              </div>
            )}

            <ul className="divide-y divide-border/60 border-t border-border/60">
              {c.datasets.map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                  <span className="min-w-0 flex-1 truncate">{d.name.replace("HubSpot · ", "")}</span>
                  {d.syncError ? (
                    <span className="max-w-[55%] truncate text-destructive" title={d.syncError}>{d.syncError}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {d.syncing ? "Syncing" : `${(d.rowCount ?? 0).toLocaleString("en-US")} rows · updated ${ago(d.lastSyncedAt)}`}
                    </span>
                  )}
                </li>
              ))}
              {c.datasets.length === 0 && (
                <li className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
                  Nothing is being brought in yet.
                  <Button size="xs" variant="outline" onClick={() => setWizard({ connectionId: c.id, step: "choose" })}>Choose data</Button>
                </li>
              )}
            </ul>
          </div>
        ))
      )}

      <HubSpotGuideDialog open={guide} onOpenChange={setGuide} onConnect={() => setWizard({ step: "connect" })} />
      <ConnectHubSpotDialog
        open={wizard !== null}
        onOpenChange={(o) => !o && setWizard(null)}
        connectionId={wizard?.connectionId}
        initialStep={wizard?.step}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {removing?.accountLabel ?? "HubSpot"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Rex stops reading from HubSpot and deletes the saved key straight away. Choose what happens to the data it already brought in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-xs" role="radiogroup" aria-label="What to do with the data">
            {([
              ["keep", "Keep the data", "Dashboards keep working with the last copy. It just stops updating."],
              ["delete", "Delete the data", "Removes the HubSpot datasets and their files. Dashboards that use them will show empty tiles."],
            ] as const).map(([value, title, hint]) => (
              <label key={value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5", removeMode === value ? "border-foreground/40 bg-muted/40" : "border-border")}>
                <input type="radio" name="remove-mode" className="mt-0.5" checked={removeMode === value} onChange={() => setRemoveMode(value)} />
                <span><span className="block font-medium">{title}</span><span className="text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={disconnect.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && disconnect.mutate({ connectionId: removing.id, mode: removeMode }, {
                onSuccess: () => { toast.success("HubSpot disconnected"); setRemoving(null) },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't disconnect"),
              })}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
