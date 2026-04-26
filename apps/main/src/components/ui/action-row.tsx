"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { CopyButton } from "@/components/ui/copy-button"
import { cn } from "@/lib/utils"

interface ActionRowProps {
  /** Render a Copy button. */
  copy?: { text: string; label?: string }
  /** Render a Download anchor. */
  download?: { href: string; name?: string; label?: string }
  /** Trailing slot for arbitrary actions (e.g. a Publish dialog button). */
  children?: React.ReactNode
  className?: string
  /** Justification of the row. Default `end`. */
  align?: "start" | "between" | "end"
}

export function ActionRow({
  copy,
  download,
  children,
  className,
  align = "end",
}: ActionRowProps) {
  if (!copy && !download && !children) return null
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        align === "start" && "justify-start",
        align === "between" && "justify-between",
        align === "end" && "justify-end",
        className
      )}
    >
      {copy && <CopyButton text={copy.text} label={copy.label} />}
      {download && (
        <a
          href={download.href}
          download={download.name}
          className="inline-flex h-6 items-center gap-1 border border-border px-2 text-xs hover:bg-muted"
        >
          <Download className="size-3" />
          {download.label ?? "Download"}
        </a>
      )}
      {children}
    </div>
  )
}
