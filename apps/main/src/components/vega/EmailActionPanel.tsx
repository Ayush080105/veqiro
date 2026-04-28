"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReplyEditor } from "./ReplyEditor"
import { Star, Calendar, Clock, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"
import { sendReply } from "@/lib/api/vega-inbox"
import { createFollowUp } from "@/lib/api/vega-followups"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

interface EmailActionPanelProps {
  email: TriagedEmail
  onReplySent: () => void
  onFollowUpScheduled: () => void
  onClose: () => void
}

const FOLLOW_UP_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "1 week", hours: 168 },
]

type ActiveView = "reply" | "followup" | null

export function EmailActionPanel({
  email,
  onReplySent,
  onFollowUpScheduled,
  onClose,
}: EmailActionPanelProps) {
  const [activeView, setActiveView] = useState<ActiveView>(
    email.uiCategory === "reply_now" ? "reply" : null
  )
  const [followUpHours, setFollowUpHours] = useState("48")
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false)

  const handleSendReply = async (body: string) => {
    await sendReply(email.emailId, {
      to: email.fromEmail,
      subject: email.subject,
      body,
      threadId: email.threadId,
    })
    toast.success("Reply sent")
    onReplySent()
  }

  const handleScheduleFollowUp = async () => {
    setSchedulingFollowUp(true)
    try {
      const hours = parseInt(followUpHours, 10)
      const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString()
      await createFollowUp({
        emailId: email.emailId,
        emailSubject: email.subject,
        senderEmail: email.fromEmail,
        dueAt,
        draftText: email.suggestedReply ?? `Hi ${email.fromName},\n\nJust following up on this.\n\nBest,`,
      })
      toast.success(`Follow-up scheduled for ${followUpHours}h from now`)
      setActiveView(null)
      onFollowUpScheduled()
    } catch {
      toast.error("Failed to schedule follow-up")
    } finally {
      setSchedulingFollowUp(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {email.isVIP && <Star className="size-3.5 fill-current" style={{ color: "#F5C518" }} />}
            <span className="text-sm font-semibold truncate">{email.fromName}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate">{email.fromEmail}</span>
          <p className="text-xs font-medium mt-1">{email.subject}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* AI Summary */}
      <Card style={{ border: "2px solid #E5E5E5", background: "#FFF9ED" }}>
        <CardContent className="p-3">
          <p className="text-xs leading-relaxed text-foreground">{email.summary}</p>
        </CardContent>
      </Card>

      {/* Hidden Tasks */}
      {email.hiddenTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertCircle className="size-3.5" />
            Hidden Tasks
          </div>
          {email.hiddenTasks.map((task, i) => (
            <div
              key={i}
              className="text-xs text-foreground pl-5"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              · {task}
            </div>
          ))}
        </div>
      )}

      {/* Meeting Request Badge */}
      {email.meetingRequest && (
        <Badge
          style={{ background: "#EEF9F6", color: "#1DBC87", border: "1px solid #1DBC87", alignSelf: "start" }}
        >
          <Calendar className="size-3 mr-1" />
          Meeting request detected
        </Badge>
      )}

      {/* Action Buttons */}
      {activeView === null && (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setActiveView("reply")}
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111", justifyContent: "start" }}
            size="sm"
          >
            Draft Reply
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveView("followup")}
            style={{ border: "2px solid #111", justifyContent: "start" }}
            size="sm"
          >
            <Clock className="size-3.5" />
            Follow-up Later
          </Button>
        </div>
      )}

      {/* Reply View */}
      {activeView === "reply" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Reply to {email.fromName}</span>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setActiveView(null)}>
              ← Back
            </Button>
          </div>
          <ReplyEditor
            initialDraft={email.suggestedReply}
            onSend={handleSendReply}
            onDiscard={() => setActiveView(null)}
          />
        </div>
      )}

      {/* Follow-up View */}
      {activeView === "followup" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Schedule Follow-up</span>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setActiveView(null)}>
              ← Back
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vega will remind you to follow up on this email.
          </p>
          <Select value={followUpHours} onValueChange={setFollowUpHours}>
            <SelectTrigger style={{ border: "2px solid #111", fontSize: 12, fontFamily: "var(--font-mono)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <SelectItem key={opt.hours} value={String(opt.hours)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleScheduleFollowUp}
            disabled={schedulingFollowUp}
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            size="sm"
          >
            <Clock className="size-3.5" />
            {schedulingFollowUp ? "Scheduling…" : "Schedule Follow-up"}
          </Button>
        </div>
      )}
    </div>
  )
}
