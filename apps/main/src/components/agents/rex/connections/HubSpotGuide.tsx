"use client"

import * as React from "react"
import { CircleHelp, Info, Lock } from "lucide-react"

import { useConnections } from "@/lib/api/rexConnections"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { availableMethods, currentMethod, METHOD_LABEL, type ConnectMethod } from "./connect-method-options"
import { HUBSPOT_CORE_SCOPES, HUBSPOT_OPTIONAL_SCOPES } from "./templates"

const SCOPE_TEXT = [...HUBSPOT_CORE_SCOPES, ...HUBSPOT_OPTIONAL_SCOPES].join("\n")

function Scopes() {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <details className="text-[11px]">
        <summary className="cursor-pointer text-foreground">See the scopes</summary>
        <div className="mt-1.5 flex flex-col gap-1 rounded-md bg-muted/50 p-2">
          <p className="font-medium text-foreground">Needed for deals, companies and contacts</p>
          <p className="font-mono leading-relaxed break-words">{HUBSPOT_CORE_SCOPES.join(" ")}</p>
          <p className="mt-1 font-medium text-foreground">Optional: tickets, products, quotes and custom objects</p>
          <p className="font-mono leading-relaxed break-words">{HUBSPOT_OPTIONAL_SCOPES.join(" ")}</p>
        </div>
      </details>
      <div className="flex items-center gap-2">
        <CopyButton text={SCOPE_TEXT} label="Copy all scopes" variant="outline" size="xs" />
        <span className="text-[11px]">One per line, ready to paste. All are read only.</span>
      </div>
    </div>
  )
}

/** The steps for one way of connecting, in plain language. */
export function MethodGuide({ method }: { method: ConnectMethod }) {
  if (method === "oauth") {
    return (
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p>The quickest way. There is nothing to copy or paste.</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>Select <span className="text-foreground">Connect with HubSpot</span>. HubSpot opens in this window.</li>
          <li>Sign in and choose the HubSpot account to connect.</li>
          <li>Approve read-only access. This needs a HubSpot <span className="text-foreground">Super Admin</span>, or someone with Marketplace access.</li>
          <li>You come back here, and Rex shows what it can read.</li>
        </ol>
        <p className="flex gap-2"><Info className="mt-0.5 size-3 shrink-0" />HubSpot may label the app as unverified. That is expected until it is listed on the HubSpot Marketplace.</p>
      </div>
    )
  }
  if (method === "service-key") {
    return (
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p>A Service Key is a password that only allows what you tick. It is HubSpot&apos;s current way to connect tools, and there is nothing to build.</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            In HubSpot, open <span className="text-foreground">Development</span>, then <span className="text-foreground">Keys</span>, then <span className="text-foreground">Service keys</span>.
            Some accounts show it under the gear icon (Settings), then Integrations, then Service Keys. You need to be a Super Admin or have Developer tools access.
          </li>
          <li>Select <span className="text-foreground">Create service key</span> and name it, for example &ldquo;Veqiro&rdquo;.</li>
          <li>
            Add the read scopes Rex needs.
            <Scopes />
          </li>
          <li>Create the key and copy it. Treat it like a password.</li>
          <li>Paste it into the box on this page and select <span className="text-foreground">Connect</span>.</li>
        </ol>
        <p className="flex gap-2"><Info className="mt-0.5 size-3 shrink-0" />Menu names can differ slightly between HubSpot accounts. If you can&apos;t find Service keys, ask a HubSpot Super Admin to create one, or use a private app token.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <p>For accounts that already have a private app. HubSpot stops letting accounts create new private apps from 26 October 2026 (new accounts already can&apos;t). Existing ones keep working. If you can&apos;t create one, use a Service Key.</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>In HubSpot, select the gear icon (Settings), then <span className="text-foreground">Integrations</span>, then <span className="text-foreground">Private Apps</span>.</li>
        <li>Open your app, or select <span className="text-foreground">Create private app</span> and name it.</li>
        <li>
          On the <span className="text-foreground">Scopes</span> tab, add the read scopes Rex needs.
          <Scopes />
        </li>
        <li>Create the app, then select <span className="text-foreground">Show token</span> and copy it.</li>
        <li>Paste it into the box on this page and select <span className="text-foreground">Connect</span>.</li>
      </ol>
    </div>
  )
}

/** Small ⓘ button that sits next to "Connect HubSpot" wherever it appears. */
export function GuideButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button" variant="ghost" size="icon-sm" onClick={onClick} className={className}
      aria-label="How connecting HubSpot works" title="How connecting HubSpot works"
    >
      <CircleHelp className="size-4 text-muted-foreground" />
    </Button>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-md border border-border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">{q}</summary>
      <div className="mt-1.5 text-muted-foreground">{children}</div>
    </details>
  )
}

/**
 * The full explanation: what connecting does, how to connect each way, what is kept private, and
 * what to do when it goes wrong. The one-click method is only listed when the server has it set up.
 */
export function HubSpotGuideDialog({
  open,
  onOpenChange,
  onConnect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Closes the guide and opens the connect window. */
  onConnect?: () => void
}) {
  const { data } = useConnections()
  const oauth = data?.oauthAvailable === true
  const methods = availableMethods(oauth)
  const [picked, setPicked] = React.useState<ConnectMethod | null>(null)
  const method = currentMethod(picked, oauth)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Using HubSpot in Rex</DialogTitle>
          <DialogDescription>Build dashboards from your HubSpot deals, companies, contacts and tickets, and keep them up to date on their own.</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-1.5 text-xs">
          <p className="font-medium">How it works</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            <li>You connect once. Rex reads your records, <span className="text-foreground">read only</span>, and never changes anything in HubSpot.</li>
            <li>Each kind of record (deals, companies, and so on) becomes a table you can build dashboards from, by describing what you want.</li>
            <li>Dashboards stay fresh: about a minute while open, every 5 minutes in the background, and instantly with the Refresh button.</li>
            <li>You find your connection under <span className="text-foreground">Data, Live data sources</span>, and your dashboards under <span className="text-foreground">Work, Dashboards</span>.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="text-xs font-medium">Pick a way to connect</p>
          <SegmentedGroup
            size="sm" value={method} onValueChange={setPicked}
            options={methods.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
          />
          <MethodGuide method={method} />
        </section>

        <section className="flex flex-col gap-1.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium"><Lock className="size-3.5" /> Your data and privacy</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            <li>Your key is encrypted and never shown again, to you or anyone.</li>
            <li>Names, emails and phone numbers of contacts are left out unless you choose them. Making a dashboard public asks you to confirm if it uses them.</li>
            <li>You can disconnect any time and choose to keep or delete the data Rex already copied.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-1.5">
          <p className="text-xs font-medium">If something goes wrong</p>
          <Faq q="&ldquo;HubSpot rejected that key&rdquo;">Copy the whole key again, with nothing before or after it, and check it hasn&apos;t been deleted in HubSpot.</Faq>
          <Faq q="An object shows &ldquo;needs a scope&rdquo;">Add the scope it names to your key in HubSpot, then select <span className="text-foreground">Check again</span> in the connect window. No need to start over.</Faq>
          <Faq q="The connection says &ldquo;Needs reconnecting&rdquo;">The key was removed or expired. Choose <span className="text-foreground">Reconnect</span>, paste a new key from the same HubSpot account, and everything carries on. Your dashboards keep showing the last data meanwhile.</Faq>
          <Faq q="Why don&apos;t I see Connect with HubSpot?">That one-click option appears once it has been set up for your Veqiro workspace. A Service Key does the same job today.</Faq>
        </section>

        {onConnect && (
          <div className="flex justify-end">
            <Button onClick={() => { onOpenChange(false); onConnect() }}>Connect HubSpot</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
