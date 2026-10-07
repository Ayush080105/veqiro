"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Info, KeyRound, Loader2, RefreshCw, Sparkles, SlidersHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/client"
import {
  dashboardsPath, useConnections, useConnectToken, useSaveSelection, useStartOAuth, useVerify,
  type ObjectSelection, type VerifyReport,
} from "@/lib/api/rexConnections"
import { useCreateDashboard } from "@/lib/api/rexDashboards"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/ui/copy-button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { FieldPicker } from "./FieldPicker"
import { HUBSPOT_CORE_SCOPES, HUBSPOT_OPTIONAL_SCOPES, HUBSPOT_TEMPLATES } from "./templates"

export type WizardStep = "connect" | "verify" | "choose" | "sync"
const ORDER: WizardStep[] = ["connect", "verify", "choose", "sync"]
const TITLES: Record<WizardStep, string> = {
  connect: "Connect HubSpot",
  verify: "Check what Rex can read",
  choose: "Choose your data",
  sync: "Bringing your data in",
}
const ROW_CAP = 100_000
const num = new Intl.NumberFormat("en-US")

function Steps({ step }: { step: WizardStep }) {
  const at = ORDER.indexOf(step)
  return (
    <ol className="flex gap-1.5" aria-label={`Step ${at + 1} of ${ORDER.length}`}>
      {ORDER.map((s, i) => (
        <li key={s} className={cn("h-1 flex-1 rounded-full", i <= at ? "bg-[#1DBC87]" : "bg-border")} aria-hidden />
      ))}
    </ol>
  )
}

export function ConnectHubSpotDialog({
  open,
  onOpenChange,
  connectionId: resumeId,
  initialStep = "connect",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Resume an existing connection (after OAuth, or to change which data is brought in). */
  connectionId?: string
  initialStep?: WizardStep
}) {
  const router = useRouter()
  const { data: conns } = useConnections({ poll: open })
  const connectToken = useConnectToken()
  const startOAuth = useStartOAuth()
  const verify = useVerify()
  const saveSelection = useSaveSelection()
  const createDashboard = useCreateDashboard()

  const [step, setStep] = React.useState<WizardStep>(resumeId ? initialStep : "connect")
  const [connectionId, setConnectionId] = React.useState<string | undefined>(resumeId)
  const [report, setReport] = React.useState<VerifyReport | null>(null)
  const [token, setToken] = React.useState("")
  const [showHow, setShowHow] = React.useState(false)
  const [picked, setPicked] = React.useState<Record<string, ObjectSelection | null>>({})
  const [customising, setCustomising] = React.useState<string | null>(null)
  const [building, setBuilding] = React.useState<string | null>(null)

  const connection = conns?.connections.find((c) => c.id === connectionId)

  // Reset when the dialog is reopened for a different purpose.
  React.useEffect(() => {
    if (!open) return
    setConnectionId(resumeId)
    setStep(resumeId ? initialStep : "connect")
    setReport(null)
    setToken("")
    setCustomising(null)
  }, [open, resumeId, initialStep])

  // Resuming (after OAuth, or editing): read access fresh so counts and scopes are current.
  React.useEffect(() => {
    if (open && connectionId && !report && step !== "connect" && step !== "sync") {
      verify.mutate(connectionId, {
        onSuccess: setReport,
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't check HubSpot access"),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connectionId, step])

  // Default choices: the core objects that are readable, plus whatever was chosen before.
  React.useEffect(() => {
    if (!report) return
    setPicked((prev) => {
      const next = { ...prev }
      for (const o of report.objects) {
        if (!(o.type in next)) {
          const existing = connection?.datasets.find((d) => d.object === o.type)
          next[o.type] = existing ? existing.selection : o.ok && o.tier === 1 ? { extra: [], includePii: [] } : null
        }
      }
      return next
    })
  }, [report, connection])

  const connectWithKey = () =>
    connectToken.mutate(token, {
      onSuccess: (out) => {
        setConnectionId(out.connectionId)
        setReport(out.verify)
        setToken("")
        setStep("verify")
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't connect to HubSpot"),
    })

  const connectWithHubSpot = () =>
    startOAuth.mutate(`${window.location.pathname}${window.location.search}`, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't start the HubSpot connection"),
    })

  const recheck = () =>
    connectionId && verify.mutate(connectionId, {
      onSuccess: (r) => { setReport(r); toast.success("Access re-checked") },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't check HubSpot access"),
    })

  const chosen = Object.entries(picked).filter(([, v]) => v !== null) as Array<[string, ObjectSelection]>

  const start = () =>
    connectionId && saveSelection.mutate(
      { connectionId, objects: chosen.map(([type, sel]) => ({ type, ...sel })) },
      {
        onSuccess: () => setStep("sync"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save your choices"),
      },
    )

  // ── Sync progress ──
  const datasets = connection?.datasets ?? []
  const settled = (d: (typeof datasets)[number]) => !d.syncing && (d.lastSyncedAt !== null || d.syncError !== null)
  const allDone = datasets.length > 0 && datasets.every(settled)
  const ready = (object: string) => datasets.find((d) => d.object === object && d.lastSyncedAt && !d.syncError)

  const buildFrom = (id: string) => {
    const t = HUBSPOT_TEMPLATES.find((x) => x.id === id)!
    const ids = t.needs.map((n) => ready(n)?.id).filter(Boolean) as string[]
    // A template reads its own objects plus anything else synced, so the model can join them.
    const extra = datasets.filter((d) => ready(d.object) && !ids.includes(d.id)).map((d) => d.id)
    setBuilding(id)
    createDashboard.mutate(
      { prompt: t.prompt, datasetIds: [...ids, ...extra].slice(0, 5) },
      {
        onSuccess: (d) => {
          onOpenChange(false)
          for (const drop of d.dropped ?? []) toast.warning(`Skipped "${drop.title}": ${drop.error}`)
          router.push(`${dashboardsPath}/${d.id}`)
        },
        onError: (err) => { setBuilding(null); toast.error(err instanceof Error ? err.message : "Couldn't build the dashboard") },
      },
    )
  }

  const busy = connectToken.isPending || startOAuth.isPending || saveSelection.isPending || createDashboard.isPending
  const scopeText = [...HUBSPOT_CORE_SCOPES, ...HUBSPOT_OPTIONAL_SCOPES].join("\n")

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <Steps step={step} />
          <DialogTitle className="pt-2 text-base">{TITLES[step]}</DialogTitle>
          <DialogDescription>
            {step === "connect" && "Rex reads your HubSpot records, read only, and keeps your dashboards up to date. It never changes anything in HubSpot."}
            {step === "verify" && (report?.account ? `Connected to ${report.account}. Here is what this connection can read.` : "Here is what this connection can read.")}
            {step === "choose" && "Pick what to bring in. You can add more later, and each object becomes a table your dashboards can use."}
            {step === "sync" && "This runs in the background. You can close this window and come back."}
          </DialogDescription>
        </DialogHeader>

        {/* ── 1. Connect ── */}
        {step === "connect" && (
          <div className="flex flex-col gap-4">
            {conns?.oauthAvailable && (
              <>
                <Button size="lg" onClick={connectWithHubSpot} disabled={busy} className="justify-center">
                  {startOAuth.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Connect with HubSpot
                </Button>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground" aria-hidden>
                  <span className="h-px flex-1 bg-border" /> or use a key <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (token.trim()) connectWithKey() }}>
              <label htmlFor="hs-token" className="text-xs font-medium">HubSpot Service Key or private app token</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="hs-token" type="password" autoComplete="off" spellCheck={false} value={token}
                    onChange={(e) => setToken(e.target.value)} placeholder="Paste the key here" className="pl-8 font-mono text-xs"
                  />
                </div>
                <Button type="submit" disabled={!token.trim() || busy}>
                  {connectToken.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Checking</> : "Connect"}
                </Button>
              </div>
              {connectToken.error instanceof ApiError && <p className="text-xs text-destructive">{connectToken.error.message}</p>}
            </form>

            <div className="rounded-md border border-border">
              <button
                type="button" onClick={() => setShowHow((s) => !s)} aria-expanded={showHow}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-muted/40"
              >
                How to get a key
                <ChevronDown className={cn("size-3.5 transition-transform", showHow && "rotate-180")} />
              </button>
              {showHow && (
                <ol className="flex list-decimal flex-col gap-2 border-t border-border px-3 py-3 pl-7 text-xs text-muted-foreground">
                  <li>In HubSpot, open <span className="text-foreground">Settings, Integrations, Service Keys</span> and choose Create service key.</li>
                  <li>
                    Add these read-only scopes. The first seven give Rex your deals, companies and contacts; the rest unlock tickets, products and custom objects.
                    <div className="mt-1.5 flex items-center gap-2">
                      <CopyButton text={scopeText} label="Copy all scopes" variant="outline" size="xs" />
                      <span className="text-[11px]">One scope per line</span>
                    </div>
                  </li>
                  <li>Create the key, copy it, and paste it above.</li>
                </ol>
              )}
            </div>
            <p className="flex gap-2 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              HubSpot stops letting accounts create new private apps on 26 October 2026 and replaces them with Service Keys. Existing private app tokens keep working.
            </p>
          </div>
        )}

        {/* ── 2. Verify ── */}
        {step === "verify" && (
          <div className="flex flex-col gap-3">
            {!report ? (
              <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Checking access</div>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {report.objects.map((o) => (
                  <li key={o.type} className="flex items-start gap-2.5 px-3 py-2 text-xs">
                    {o.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-[#1DBC87]" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{o.label}</span>
                      {!o.ok && (
                        <span className="block text-muted-foreground">
                          {o.missingScope ? <>Add the <code className="rounded bg-muted px-1">{o.missingScope}</code> scope to your key, then check again.</> : o.message ?? "Not available to this key."}
                        </span>
                      )}
                    </span>
                    {o.ok && o.count !== null && <span className="tabular-nums text-muted-foreground">{num.format(o.count)} records</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={recheck} disabled={!report || verify.isPending}>
                <RefreshCw className={cn("size-3.5", verify.isPending && "animate-spin")} /> Check again
              </Button>
              <Button onClick={() => setStep("choose")} disabled={!report?.objects.some((o) => o.ok)}>Continue</Button>
            </div>
          </div>
        )}

        {/* ── 3. Choose ── */}
        {step === "choose" && (
          <div className="flex flex-col gap-3">
            {!report ? (
              <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {report.objects.filter((o) => o.ok).map((o) => {
                  const sel = picked[o.type] ?? null
                  const open = customising === o.type
                  return (
                    <li key={o.type} className="rounded-md border border-border">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          checked={sel !== null} aria-label={`Bring in ${o.label}`}
                          onCheckedChange={(v) => setPicked((p) => ({ ...p, [o.type]: v ? (p[o.type] ?? { extra: [], includePii: [] }) : null }))}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{o.label}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {o.count !== null ? `${num.format(o.count)} records` : "Record count unavailable"}
                            {o.count !== null && o.count > ROW_CAP && ` · Rex keeps the first ${num.format(ROW_CAP)}`}
                          </span>
                        </span>
                        {sel && (
                          <Button variant="ghost" size="sm" onClick={() => setCustomising(open ? null : o.type)} aria-expanded={open}>
                            <SlidersHorizontal className="size-3.5" /> Fields
                            {sel.extra.length + sel.includePii.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px]">+{sel.extra.length + sel.includePii.length}</span>}
                          </Button>
                        )}
                      </div>
                      {sel && open && connectionId && (
                        <div className="border-t border-border px-3 py-3">
                          <FieldPicker connectionId={connectionId} objectType={o.type} value={sel} onChange={(next) => setPicked((p) => ({ ...p, [o.type]: next }))} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("verify")}>Back</Button>
              <Button onClick={start} disabled={chosen.length === 0 || busy}>
                {saveSelection.isPending ? <><Loader2 className="size-3.5 animate-spin" /> Saving</> : `Bring in ${chosen.length} ${chosen.length === 1 ? "object" : "objects"}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── 4. Sync ── */}
        {step === "sync" && (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-border rounded-md border border-border" aria-live="polite">
              {datasets.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">Starting</li>}
              {datasets.map((d) => (
                <li key={d.id} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                  {d.syncError ? <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                    : settled(d) ? <Check className="size-3.5 shrink-0 text-[#1DBC87]" />
                    : <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    {d.syncError && <span className="block text-destructive">{d.syncError}</span>}
                    {d.syncNote && !d.syncError && <span className="block text-muted-foreground">{d.syncNote}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {d.syncError ? "Failed" : settled(d) ? `${num.format(d.rowCount ?? 0)} rows` : "Pulling records"}
                  </span>
                </li>
              ))}
            </ul>

            {allDone ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium">Start with a dashboard</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {HUBSPOT_TEMPLATES.map((t) => {
                    const missing = t.needs.filter((n) => !ready(n))
                    return (
                      <button
                        key={t.id} type="button" disabled={missing.length > 0 || busy} onClick={() => buildFrom(t.id)}
                        className="flex flex-col gap-0.5 rounded-md border border-border p-3 text-left transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {building === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-[#1DBC87]" />}
                          {t.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{missing.length ? `Needs ${missing.join(" and ")} synced` : t.blurb}</span>
                      </button>
                    )
                  })}
                </div>
                {building && <p className="text-center text-[11px] text-muted-foreground">Rex is reading every row and checking each chart&apos;s numbers. This takes a little while.</p>}
                <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Done</Button></div>
              </div>
            ) : (
              <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close and keep syncing</Button></div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
