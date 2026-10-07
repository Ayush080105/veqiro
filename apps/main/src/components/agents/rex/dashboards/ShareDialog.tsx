"use client"

import * as React from "react"
import { AlertTriangle, ExternalLink, Globe, Lock } from "lucide-react"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/client"
import { publicDashboardUrl, useShareDashboard, type Dashboard } from "@/lib/api/rexDashboards"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

export function ShareDialog({
  dashboard,
  open,
  onOpenChange,
}: {
  dashboard: Dashboard
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const share = useShareDashboard(dashboard.id)
  const url = dashboard.shareToken ? publicDashboardUrl(dashboard.shareToken) : ""
  const hasTables = dashboard.widgets.some((w) => w.kind === "table")
  // The server refuses to publish personal data until the owner says yes; keep its wording.
  const [confirmText, setConfirmText] = React.useState<string | null>(null)

  const toggle = (isPublic: boolean, confirmPii = false) =>
    share.mutate({ isPublic, confirmPii }, {
      onSuccess: () => {
        setConfirmText(null)
        toast.success(isPublic ? "Anyone with the link can view it" : "Link turned off")
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) setConfirmText(err.message)
        else toast.error(err instanceof Error ? err.message : "Couldn't change sharing")
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share dashboard</DialogTitle>
          <DialogDescription>
            A read-only page anyone with the link can open, no Veqiro account needed. It updates when your data does.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-3 rounded-md border border-border p-3">
          {dashboard.isPublic ? <Globe className="size-4 text-[#1DBC87]" /> : <Lock className="size-4 text-muted-foreground" />}
          <span className="flex-1 text-sm">
            {dashboard.isPublic ? "Public link is on" : "Only your workspace can see this"}
          </span>
          <Switch checked={dashboard.isPublic} disabled={share.isPending} onCheckedChange={(v) => toggle(!!v)} />
        </label>

        {confirmText && (
          <div role="alert" className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />{confirmText}</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmText(null)}>Keep it private</Button>
              <Button size="sm" onClick={() => toggle(true, true)} disabled={share.isPending}>Make it public</Button>
            </div>
          </div>
        )}

        {dashboard.isPublic && url && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input readOnly value={url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={url} iconOnly variant="outline" />
              <Button variant="outline" size="icon" render={<a href={url} target="_blank" rel="noreferrer" aria-label="Open" />}>
                <ExternalLink className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Viewers see the charts and numbers only — never your spreadsheet, its name, or the queries.
              {hasTables && " Table tiles do show their rows."} Turning the link off and on again makes a new link.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
