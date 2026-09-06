"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

export default function DashboardErrorBoundary({
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
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="error"
        title="Something went wrong"
        subtitle="This page hit a snag loading. Give it another try — if it keeps happening, our team has already been notified."
        sticker={{ label: "!", rot: -4, color: "var(--vq-red)" }}
      />

      <div className="px-3.5 py-4 bg-card border border-dashed border-[var(--vq-line-2)] rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
          {"// "}
          {error.digest ?? "unexpected error"}
        </span>
        <Button variant="brand-dark" size="brand-sm" onClick={() => reset()}>
          try again
        </Button>
      </div>
    </div>
  )
}
