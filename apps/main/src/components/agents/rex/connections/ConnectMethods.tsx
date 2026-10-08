"use client"

import * as React from "react"
import { AlertTriangle, ArrowRight, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { availableMethods, currentMethod, METHOD_LABEL, type ConnectMethod } from "./connect-method-options"
import { MethodGuide } from "./HubSpotGuide"

/**
 * Step 1 of the connect window: choose how to connect and follow the steps for that way, right where
 * the key is pasted. "Connect with HubSpot" is only offered when the server has it set up.
 */
export function ConnectMethods({
  oauthAvailable,
  unavailable,
  reconnecting,
  token,
  onTokenChange,
  keyPending,
  oauthPending,
  busy,
  error,
  onSubmitKey,
  onOAuth,
}: {
  oauthAvailable: boolean
  /** The server cannot store keys yet (no encryption key configured). */
  unavailable: boolean
  reconnecting: boolean
  token: string
  onTokenChange: (value: string) => void
  keyPending: boolean
  oauthPending: boolean
  busy: boolean
  error?: string
  onSubmitKey: () => void
  onOAuth: () => void
}) {
  const methods = availableMethods(oauthAvailable)
  const [picked, setPicked] = React.useState<ConnectMethod | null>(null)
  const method = currentMethod(picked, oauthAvailable)

  return (
    <div className="flex flex-col gap-4">
      {unavailable && (
        <p role="alert" className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          Connecting accounts isn&apos;t set up on this server yet. An admin needs to set INTEGRATION_SECRET_KEY before HubSpot can be connected.
        </p>
      )}

      <SegmentedGroup
        label="How do you want to connect?" size="sm" value={method} onValueChange={setPicked}
        options={methods.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
      />

      <MethodGuide method={method} />

      {method === "oauth" ? (
        <Button size="lg" onClick={onOAuth} disabled={busy || unavailable} className="justify-center">
          {oauthPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {reconnecting ? "Reconnect with HubSpot" : "Connect with HubSpot"}
        </Button>
      ) : (
        <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); if (token.trim()) onSubmitKey() }}>
          <label htmlFor="hs-token" className="text-xs font-medium">
            {method === "service-key" ? "Paste your Service Key" : "Paste your private app token"}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="hs-token" type="password" autoComplete="off" spellCheck={false} value={token} disabled={unavailable}
                onChange={(e) => onTokenChange(e.target.value)} placeholder="Paste the key here" className="pl-8 font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={!token.trim() || busy || unavailable}>
              {keyPending ? <><Loader2 className="size-3.5 animate-spin" /> Checking</> : reconnecting ? "Reconnect" : "Connect"}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-[11px] text-muted-foreground">Your key is encrypted as soon as it is checked and is never shown again.</p>
        </form>
      )}
    </div>
  )
}
