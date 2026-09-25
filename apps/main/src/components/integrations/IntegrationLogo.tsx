"use client"

import { useState } from "react"

/**
 * logoUrl comes from a mix of sources (Composio's logo API, jsdelivr-hosted
 * open logos, favicon fallbacks — real brand icons, already coloured), so
 * this renders as a plain <img>, not a CSS mask. Falls back to a two-letter
 * initials badge if there's no URL, or if the image fails to load (external
 * hosts we don't control).
 *
 * In dark mode the logo sits on a light tile: several brand marks are black
 * (X, Notion, GitHub…) and would vanish against a dark card.
 */
export function IntegrationLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (!logoUrl || failed) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable third-party logo hosts
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className="size-8 shrink-0 rounded-md object-contain dark:bg-white/95 dark:p-1"
      onError={() => setFailed(true)}
    />
  )
}
