"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  Reply,
  Sparkles,
  Star,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { createFollowUp } from "@/lib/api/vega-followups"
import {
  draftVegaReply,
  fetchEmailThread,
  sendReply,
  type EmailThreadMessage,
  type TriagedEmail,
} from "@/lib/api/vega-inbox"
import { qk } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { ReplyEditor } from "./ReplyEditor"

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

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const ALLOWED_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DIV",
  "EM",
  "FONT",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "IMG",
  "LI",
  "OL",
  "P",
  "PRE",
  "S",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL",
])

const ALLOWED_ATTRS = new Set([
  "align",
  "alt",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "colspan",
  "height",
  "href",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
  "width",
])

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("cid:") ||
    trimmed.startsWith("data:image/")
  )
}

function sanitizeStyle(value: string): string {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const lower = declaration.toLowerCase()
      return (
        lower &&
        !lower.includes("expression(") &&
        !lower.includes("javascript:") &&
        !lower.includes("behavior:") &&
        !lower.includes("url(")
      )
    })
    .join("; ")
}

function sanitizeEmailHtml(html: string): string {
  if (typeof window === "undefined") return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("script, style, iframe, object, embed, form, input, button, meta, link").forEach((node) => {
    node.remove()
  })

  doc.body.querySelectorAll("*").forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
        element.removeAttribute(attr.name)
        continue
      }
      if ((name === "href" || name === "src") && !isSafeUrl(value)) {
        element.removeAttribute(attr.name)
        continue
      }
      if (name === "style") {
        const cleanStyle = sanitizeStyle(value)
        if (cleanStyle) element.setAttribute("style", cleanStyle)
        else element.removeAttribute("style")
      }
    }

    if (element.tagName === "A") {
      element.setAttribute("target", "_blank")
      element.setAttribute("rel", "noopener noreferrer")
    }
    if (element.tagName === "IMG") {
      element.setAttribute("loading", "lazy")
      element.setAttribute("referrerpolicy", "no-referrer")
    }
  })

  return doc.body.innerHTML
}

export function EmailActionPanel({
  email,
  onReplySent,
  onFollowUpScheduled,
  onClose,
}: EmailActionPanelProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const router = useRouter()
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [followUpHours, setFollowUpHours] = useState("48")
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [fullDraft, setFullDraft] = useState<string | null>(null)

  const {
    data: thread,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.vegaThread(organizationId, email.emailId),
    queryFn: () => fetchEmailThread(email.emailId),
    enabled: !!organizationId && !!email.emailId,
    staleTime: 5 * 60 * 1000,
  })

  const handleDraftReply = async () => {
    setActiveView("reply")
    setDraftLoading(true)
    setFullDraft(null)
    try {
      const result = await draftVegaReply(email.emailId)
      setFullDraft(result.body)
    } catch {
      toast.error("Could not generate draft - using suggestion instead")
    } finally {
      setDraftLoading(false)
    }
  }

  const handleScheduleMeeting = () => {
    const params = new URLSearchParams({
      title: email.subject,
      attendees: email.fromEmail,
      description: email.meetingRequest
        ? `Meeting requested by ${email.fromName}. Topic: ${email.meetingRequest.topic ?? "Not specified"}.`
        : `Follow-up with ${email.fromName}.`,
    })
    router.push(`/workspace/calendar?${params.toString()}`)
  }

  const handleSendReply = async (body: string) => {
    try {
      await sendReply(email.emailId, {
        to: email.fromEmail,
        subject: email.subject,
        body,
        threadId: email.threadId ?? thread?.threadId ?? null,
      })
      toast.success("Reply sent")
      onReplySent()
    } catch {
      toast.error("Failed to send reply")
    }
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
        draftText:
          email.suggestedReply ??
          `Hi ${email.fromName},\n\nJust following up on this.\n\nBest,`,
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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex min-h-[58px] items-center gap-3 border-b-2 border-foreground/15 bg-[#FFF9ED] px-4">
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} title="Back to inbox">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {email.isVIP && <Star className="size-4 shrink-0 fill-current text-[#F5C518]" />}
            <h2 className="truncate text-base font-semibold">{email.subject}</h2>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {email.fromName || email.fromEmail} &lt;{email.fromEmail}&gt;
          </p>
        </div>
        <Badge className="hidden rounded-full border-foreground/20 bg-white text-foreground sm:inline-flex">
          {email.label}
        </Badge>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-h-0 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-52 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : isError ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <AlertCircle className="size-8 text-destructive opacity-70" />
              <p className="text-sm font-semibold text-foreground">Could not load thread</p>
              <p className="max-w-sm text-xs">
                The AI triage is available, but Gmail did not return the full message thread.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {(thread?.messages.length ? thread.messages : [fallbackMessage(email)]).map((message) => (
                <ThreadMessage key={message.id} message={message} />
              ))}

              {activeView === "reply" && (
                <section className="rounded-lg border-2 border-foreground bg-[#FFF9ED] p-3 shadow-[3px_3px_0_#111]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Reply to {email.fromName || email.fromEmail}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setActiveView(null)
                        setFullDraft(null)
                      }}
                    >
                      Close
                    </Button>
                  </div>
                  {draftLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 font-mono text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Vega is drafting your reply...
                    </div>
                  ) : (
                    <ReplyEditor
                      initialDraft={fullDraft ?? email.suggestedReply}
                      onSend={handleSendReply}
                      onDiscard={() => {
                        setActiveView(null)
                        setFullDraft(null)
                      }}
                    />
                  )}
                </section>
              )}
            </div>
          )}
        </main>

        <aside className="min-h-0 overflow-y-auto border-t-2 border-foreground/15 bg-[#F7F1E4] p-4 xl:border-l-2 xl:border-t-0">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-[#8A8AF0]" />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Vega insight
            </p>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border-2 border-foreground bg-[#FFF9ED] p-3">
              <p className="mb-2 text-sm font-semibold">Summary</p>
              <p className="text-sm leading-relaxed text-foreground">{email.summary}</p>
            </section>

            {email.hiddenTasks.length > 0 && (
              <section className="rounded-lg border-2 border-[#F06464] bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <AlertCircle className="size-4 text-[#F06464]" />
                  Hidden tasks
                </p>
                <ul className="space-y-2 text-sm">
                  {email.hiddenTasks.map((task, index) => (
                    <li key={index} className="leading-snug text-muted-foreground">
                      {task}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {email.meetingRequest && (
              <Badge className="rounded-full border-[#1DBC87] bg-[#EEF9F6] text-[#137A58]">
                <Calendar className="mr-1 size-3" />
                Meeting request detected
              </Badge>
            )}

            {activeView === "followup" ? (
              <section className="rounded-lg border-2 border-foreground bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Schedule follow-up</p>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setActiveView(null)}>
                    Cancel
                  </Button>
                </div>
                <Select value={followUpHours} onValueChange={(value) => setFollowUpHours(value ?? "48")}>
                  <SelectTrigger className="mb-3 border-2 border-foreground bg-[#FFF9ED]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_OPTIONS.map((option) => (
                      <SelectItem key={option.hours} value={String(option.hours)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleScheduleFollowUp}
                  disabled={schedulingFollowUp}
                  className="w-full"
                  size="sm"
                >
                  <Clock className="size-3.5" />
                  {schedulingFollowUp ? "Scheduling..." : "Schedule"}
                </Button>
              </section>
            ) : (
              <div className="space-y-2">
                <Button onClick={handleDraftReply} className="w-full justify-start" size="sm">
                  <Reply className="size-3.5" />
                  Draft reply
                </Button>
                {email.meetingRequest && (
                  <Button
                    variant="outline"
                    onClick={handleScheduleMeeting}
                    className="w-full justify-start"
                    size="sm"
                  >
                    <Calendar className="size-3.5" />
                    Schedule meeting
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setActiveView("followup")}
                  className="w-full justify-start"
                  size="sm"
                >
                  <Clock className="size-3.5" />
                  Follow up later
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function ThreadMessage({ message }: { message: EmailThreadMessage }) {
  const [sanitizedHtml, setSanitizedHtml] = useState("")

  useEffect(() => {
    setSanitizedHtml(message.bodyHtml ? sanitizeEmailHtml(message.bodyHtml) : "")
  }, [message.bodyHtml])

  return (
    <article className="rounded-lg border border-foreground/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {message.fromName || message.fromEmail}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {message.fromEmail} to {message.to || "me"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {formatDate(message.receivedAt)}
        </span>
      </div>
      {sanitizedHtml ? (
        <div
          className="email-html-content overflow-x-auto break-words font-body text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : (
        <div className="whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-foreground">
          {message.bodyText || message.snippet || "No plain text content available."}
        </div>
      )}
    </article>
  )
}

function fallbackMessage(email: TriagedEmail): EmailThreadMessage {
  return {
    id: email.emailId,
    threadId: email.threadId,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    to: "me",
    cc: "",
    subject: email.subject,
    receivedAt: email.receivedAt,
    snippet: email.snippet ?? email.summary,
    bodyText: email.snippet || email.summary,
    bodyHtml: null,
  }
}
