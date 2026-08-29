import * as React from "react"
import { cn } from "@/lib/utils"

interface ChipProps {
  active: boolean
  onClick: () => void
  /** Background colour applied when active. Defaults to vq-red. */
  color?: string
  children: React.ReactNode
}

/** Pill-shaped toggle button used for industry / option pickers. */
export function Chip({ active, onClick, color = "#F06464", children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border border-[var(--vq-line-2)] px-4 py-2.5 text-[13px] font-medium text-foreground transition-shadow",
        active
          ? "shadow-[var(--vq-shadow-sm)]"
          : "bg-white shadow-none",
      )}
      style={active ? { background: color } : undefined}
    >
      {children}
    </button>
  )
}
