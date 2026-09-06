"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/ui/sticker"

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <Sticker rotate={-4} tone="red">
        [ error ]
      </Sticker>

      <h1 className="font-display text-[clamp(2.5rem,8vw,5rem)] leading-none tracking-tight text-foreground">
        Something went sideways.
      </h1>

      <p className="max-w-md font-body text-sm leading-relaxed text-muted-foreground">
        That wasn&apos;t supposed to happen. Try again — if it keeps
        happening, our team has already been notified.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="brand-dark" size="brand" onClick={() => reset()}>
          Try again
        </Button>
      </div>

      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        error{error.digest ? ` · ${error.digest}` : ""}
      </span>
    </main>
  )
}
