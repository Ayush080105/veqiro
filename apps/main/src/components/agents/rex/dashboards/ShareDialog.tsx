"use client"

import { ExternalLink, Globe, Lock } from "lucide-react"
import { toast } from "sonner"

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

  const toggle = (isPublic: boolean) =>
    share.mutate(isPublic, {
      onSuccess: () => toast.success(isPublic ? "Anyone with the link can view it" : "Link turned off"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't change sharing"),
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
