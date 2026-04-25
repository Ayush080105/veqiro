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
        "cursor-pointer rounded-full border-[2.5px] border-foreground px-4 py-2.5 font-head text-[13px] uppercase tracking-wider text-foreground transition-transform",
        active
          ? "shadow-[3px_3px_0_var(--foreground)] -translate-x-px -translate-y-px"
          : "bg-white shadow-none",
      )}
      style={active ? { background: color } : undefined}
    >
      {children}
    </button>
  )
}
