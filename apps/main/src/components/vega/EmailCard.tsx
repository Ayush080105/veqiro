"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Star, AlertCircle } from "lucide-react"
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
  action_needed: { label: "Action Needed", color: "#F5C518", bg: "#FEFCE8" },
  fyi: { label: "FYI", color: "#6FCDE8", bg: "#F0FAFF" },
  can_ignore: { label: "Can Ignore", color: "#999", bg: "#F5F5F5" },
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function EmailCard({ email, isSelected, onSelect, isChecked, onCheck }: EmailCardProps) {
  const cfg = categoryConfig[email.uiCategory]

  return (
    <Card
      onClick={() => onSelect(email)}
      style={{
        border: isSelected ? "2.5px solid #111" : "2px solid #E5E5E5",
        boxShadow: isSelected ? "3px 3px 0 #111" : "none",
        cursor: "pointer",
        transition: "all 0.1s",
        background: isSelected ? "#FFF9ED" : "white",
      }}
    >
      <CardContent className="p-3 flex flex-col gap-1.5">
        {/* Row 1: sender + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {onCheck && (
              <input
                type="checkbox"
                checked={isChecked ?? false}
                onChange={(e) => {
                  e.stopPropagation()
                  onCheck(email, e.target.checked)
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: "#111", width: 13, height: 13, cursor: "pointer", flexShrink: 0 }}
              />
            )}
            {email.isVIP && (
              <Star className="size-3 shrink-0 fill-current" style={{ color: "#F5C518" }} />
            )}
            <span
              className="text-xs font-semibold truncate"
              style={{ fontFamily: "var(--font-mono)", color: "#111" }}
            >
              {email.fromName || email.fromEmail}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {timeAgo(email.receivedAt)}
          </span>
        </div>

        {/* Row 2: subject */}
        <p className="text-xs font-medium truncate text-foreground">{email.subject}</p>

        {/* Row 3: summary */}
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {email.summary}
        </p>

        {/* Row 4: hidden task + category badge */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1 min-w-0">
            {email.hiddenTasks.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                <AlertCircle className="size-3 shrink-0" />
                <span className="truncate">{email.hiddenTasks[0]}</span>
              </div>
            )}
          </div>
          <Badge
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.color}`,
              fontSize: 9,
              letterSpacing: 0.5,
              padding: "1px 6px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {cfg.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
