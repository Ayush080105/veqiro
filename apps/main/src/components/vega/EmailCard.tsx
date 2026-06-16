"use client"

import { AlertCircle, CalendarClock, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

interface EmailCardProps {
  email: TriagedEmail
  isSelected: boolean
  onSelect: (email: TriagedEmail) => void
  isChecked?: boolean
  onCheck?: (email: TriagedEmail, checked: boolean) => void
}

const categoryConfig = {
  reply_now: { label: "Reply Now", color: "#F06464", bg: "#FEF2F2" },
  action_needed: { label: "Action Needed", color: "#B88700", bg: "#FFF8D9" },
  fyi: { label: "FYI", color: "#187A91", bg: "#EAF8FC" },
  can_ignore: { label: "Can Ignore", color: "#666666", bg: "#F3F4F6" },
}

function formatTime(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return date.toLocaleString("en-US", {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: sameDay ? "numeric" : undefined,
    minute: sameDay ? "2-digit" : undefined,
  })
}

export function EmailCard({
  email,
  isSelected,
  onSelect,
  isChecked,
  onCheck,
}: EmailCardProps) {
  const cfg = categoryConfig[email.uiCategory]
  const preview = email.snippet || email.summary

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(email)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect(email)
        }
      }}
      className={cn(
        "group grid min-h-[64px] w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 border-b border-foreground/10 px-3 text-left transition-colors sm:grid-cols-[34px_minmax(120px,0.34fr)_minmax(220px,1fr)_auto]",
        isSelected ? "bg-[#FFF5DC]" : "bg-white hover:bg-[#FFF9ED]"
      )}
    >
      <span className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={isChecked ?? false}
          onCheckedChange={(checked) => onCheck?.(email, Boolean(checked))}
          aria-label={`Select ${email.subject}`}
        />
        {email.isVIP && (
          <Star className="hidden size-3.5 shrink-0 fill-current text-[#F5C518] sm:block" />
        )}
      </span>

      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-sm font-semibold text-foreground">
          {email.fromName || email.fromEmail}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {email.fromEmail}
        </span>
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground sm:hidden">
          {email.fromName || email.fromEmail}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{email.subject}</span>
          {email.meetingRequest && (
            <CalendarClock className="size-3.5 shrink-0 text-[#1DBC87]" />
          )}
          {email.hiddenTasks.length > 0 && (
            <AlertCircle className="size-3.5 shrink-0 text-[#F06464]" />
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{preview}</span>
      </span>

      <span className="flex items-center gap-2 pl-2">
        <Badge
          className="hidden rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] sm:inline-flex"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}`,
          }}
        >
          {cfg.label}
        </Badge>
        <Badge className="hidden max-w-[110px] rounded-full border-foreground/20 bg-white px-2 py-0.5 text-[10px] text-foreground md:inline-flex">
          <span className="truncate">{email.label}</span>
        </Badge>
        <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
          {formatTime(email.receivedAt)}
        </span>
      </span>
    </div>
  )
}
