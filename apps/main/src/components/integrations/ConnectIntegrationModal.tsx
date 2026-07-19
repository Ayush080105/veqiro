"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  useConnectMcp,
  useMcpConfigSchema,
  useMcpConnectionStatus,
  type McpConnectResult,
} from "@/lib/api/mcp"

interface ConnectIntegrationModalProps {
  slug: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectIntegrationModal({ slug, name, open, onOpenChange }: ConnectIntegrationModalProps) {
  const { data: schema, isLoading: schemaLoading } = useMcpConfigSchema(slug, open)
  const connect = useConnectMcp(slug)
  const [values, setValues] = useState<Record<string, string>>({})
  const [awaitingAuth, setAwaitingAuth] = useState(false)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const autoTriggeredRef = useRef(false)

  const { data: status } = useMcpConnectionStatus(slug, { enabled: awaitingAuth })

  useEffect(() => {
    if (!open) {
      setValues({})
      setAwaitingAuth(false)
      setSetupUrl(null)
      setErrorMessage(null)
      autoTriggeredRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (status?.status === "CONNECTED") {
      setAwaitingAuth(false)
      toast.success(`${name} connected`)
      onOpenChange(false)
    }
  }, [status, name, onOpenChange])

  const fields = Object.entries(schema?.properties ?? {})
  const hasFields = fields.length > 0

  function handleResult(result: McpConnectResult) {
    if (result.status === "connected") {
      toast.success(`${name} connected`)
      onOpenChange(false)
      return
    }
    if (result.status === "auth_required" || result.status === "input_required") {
      if (!result.setupUrl) {
        // No setupUrl and no config fields to submit ourselves — there is no
        // way for the user to complete this from here. Surface it as an
        // error instead of an infinite, unrecoverable "waiting" state.
        setErrorMessage(
          `${name} needs further setup that isn't available yet — no connection link was returned. Try again in a moment, or contact support if this keeps happening.`
        )
        return
      }
      // Deliberately NOT auto-opened via window.open(): even called
      // synchronously inside a click handler, browsers (Safari especially)
      // still block an empty-URL popup that gets its location set afterward —
      // that exact pattern is what popup blockers are tuned to catch. A real
      // <a> the user clicks themselves is never blocked by anything.
      setSetupUrl(result.setupUrl)
      setAwaitingAuth(true)
      return
    }
    setErrorMessage(result.message ?? "Connection failed.")
  }

  async function handleSubmit() {
    setErrorMessage(null)
    try {
      const result = await connect.mutateAsync(hasFields ? values : undefined)
      handleResult(result)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  // OAuth-only integrations (no config fields) skip the redundant "Connect"
  // button press inside this modal — clicking the card already expressed
  // intent to connect, so fire the request as soon as the schema confirms
  // there's nothing to fill in, straight to the real auth link once ready.
  // This keeps the whole flow at two clicks: the card, then the auth link.
  useEffect(() => {
    if (open && !schemaLoading && !hasFields && !autoTriggeredRef.current && !errorMessage) {
      autoTriggeredRef.current = true
      void handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schemaLoading, hasFields])

  // Manual "Connect"/"Retry" button only shows when the user has to do
  // something first (fill a form) or a previous attempt failed — never for
  // the plain OAuth case, which is handled entirely by the effect above.
  const showManualConnectButton = !awaitingAuth && (hasFields || Boolean(errorMessage))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {name}</DialogTitle>
          <DialogDescription>
            {awaitingAuth
              ? `Click below to finish connecting — this closes automatically once ${name} is connected.`
              : hasFields
                ? `Enter the details ${name} needs to connect.`
                : errorMessage
                  ? `Something went wrong connecting ${name}.`
                  : `Connecting to ${name}…`}
          </DialogDescription>
        </DialogHeader>

        {!awaitingAuth && hasFields && (
          <FieldGroup>
            {fields.map(([key, field]) => (
              <Field key={key}>
                <FieldLabel htmlFor={`mcp-field-${key}`}>{field.description ?? key}</FieldLabel>
                <FieldContent>
                  <Input
                    id={`mcp-field-${key}`}
                    type={/key|secret|token|password/i.test(key) ? "password" : "text"}
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    required={schema?.required?.includes(key)}
                  />
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
        )}

        {awaitingAuth && setupUrl && (
          <div className="flex flex-col gap-3">
            <Button asChild>
              <a href={setupUrl} target="_blank" rel="noopener noreferrer">
                Connect {name} →
              </a>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Opens in a new tab. This dialog closes automatically once you're done.
            </p>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}

        <DialogFooter>
          {showManualConnectButton && (
            <Button onClick={handleSubmit} disabled={schemaLoading || connect.isPending}>
              {connect.isPending ? "Connecting…" : errorMessage ? "Retry" : "Connect"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
