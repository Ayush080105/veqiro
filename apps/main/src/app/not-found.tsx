import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/ui/sticker"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <Sticker rotate={-4} tone="yellow">
        [ 404 ]
      </Sticker>

      <h1 className="font-display text-[clamp(3.5rem,12vw,7rem)] leading-none tracking-tight text-foreground">
        Lost the plot.
      </h1>

      <p className="max-w-md font-body text-sm leading-relaxed text-muted-foreground">
        This page doesn&apos;t exist — or wandered off somewhere none of our six AI
        employees could find it. Let&apos;s get you back on track.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="brand-dark" size="brand">
          <Link href="/dashboard">Take me home</Link>
        </Button>
      </div>

      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        error 404 · page not found
      </span>
    </main>
  )
}
