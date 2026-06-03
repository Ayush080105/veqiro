"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInbox, bulkInboxAction } from "@/lib/api/vega-inbox"
import { qk } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"
import { EmailCard } from "./EmailCard"
import { EmailActionPanel } from "./EmailActionPanel"
import { FollowUpList } from "./FollowUpList"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AlertCircle, RefreshCw, Mail, CheckSquare, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

const CATEGORIES = ["reply_now", "action_needed", "fyi", "can_ignore"] as const
const CATEGORY_LABELS = {
  reply_now: "Reply Now",
  action_needed: "Action Needed",
  fyi: "FYI",
  can_ignore: "Can Ignore",
}

export function InboxView() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const [selectedEmail, setSelectedEmail] = useState<TriagedEmail | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [canIgnoreOpen, setCanIgnoreOpen] = useState(false)
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: qk.vegaInbox(organizationId),
    queryFn: ({ meta }) => fetchInbox(20, { force: !!(meta as { force?: boolean } | undefined)?.force }),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  const handleForceRefetch = () => {
    void queryClient.fetchQuery({
      queryKey: qk.vegaInbox(organizationId),
      queryFn: () => fetchInbox(20, { force: true }),
      staleTime: 0,
    })
  }

  const invalidateInbox = () =>
    queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })

  const handleBulkAction = async (action: "ignore" | "snooze") => {
    setBulkPending(true)
    try {
      const snoozeUntil = action === "snooze"
        ? new Date(Date.now() + 24 * 3_600_000).toISOString()
        : undefined
      const result = await bulkInboxAction({
        emailIds: Array.from(checkedIds),
        action,
        snoozeUntil,
      })
      toast.success(`Done: ${result.succeeded} emails processed`)
      setCheckedIds(new Set())
      setSelectMode(false)
      invalidateInbox()
    } catch {
      toast.error("Bulk action failed")
    } finally {
      setBulkPending(false)
    }
  }

  const uniqueLabels = useMemo(
    () => [...new Set((data?.emails ?? []).map((e) => e.label))].sort(),
    [data?.emails]
  )

  const visibleEmails = useMemo(
    () =>
      activeLabel
        ? (data?.emails ?? []).filter((e) => e.label === activeLabel)
        : (data?.emails ?? []),
    [data?.emails, activeLabel]
  )

  const emailsByCategory = CATEGORIES.map((cat) => ({
    cat,
    emails: visibleEmails.filter((e) => e.uiCategory === cat),
  }))

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        <div className="w-72 shrink-0 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="size-8 text-destructive opacity-60" />
        <p className="text-sm font-medium">Could not load inbox</p>
        <p className="text-xs text-muted-foreground">Check your Google connection in Settings → Integrations</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left: email list with tabs */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: 320, borderRight: "2px solid #E5E5E5" }}
      >
        <Tabs defaultValue="inbox" className="flex flex-col h-full min-h-0">
          <div
            className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0"
            style={{ borderBottom: "2px solid #E5E5E5" }}
          >
            <TabsList style={{ background: "#F5F5F5" }}>
              <TabsTrigger value="inbox" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                Inbox
              </TabsTrigger>
              <TabsTrigger value="followups" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                Follow-ups
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1">
              <Button
                variant={selectMode ? "default" : "ghost"}
                size="icon"
                className="size-7"
                onClick={() => {
                  setSelectMode((v) => !v)
                  setCheckedIds(new Set())
                }}
                title={selectMode ? "Exit select mode" : "Select emails"}
              >
                <CheckSquare className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleForceRefetch}
                disabled={isFetching}
                title="Refresh inbox"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Bulk action bar — visible when emails are checked */}
          {selectMode && checkedIds.size > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ background: "#F0FFF8", borderBottom: "1px solid #D1FAE5" }}
            >
              <span
                className="text-xs text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {checkedIds.size} selected
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleBulkAction("snooze")}
                  disabled={bulkPending}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {bulkPending ? "…" : "Snooze 24h"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 text-destructive border-destructive hover:text-destructive"
                  onClick={() => handleBulkAction("ignore")}
                  disabled={bulkPending}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {bulkPending ? "…" : "Ignore"}
                </Button>
              </div>
            </div>
          )}

          <TabsContent value="inbox" className="flex-1 overflow-y-auto m-0 flex flex-col">
            {/* Label filter pills */}
            {uniqueLabels.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 px-3 pt-2 pb-1.5 shrink-0"
                style={{ borderBottom: "1px solid #E5E5E5" }}
              >
                <button
                  onClick={() => setActiveLabel(null)}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: 1,
                    padding: "3px 8px",
                    border: "1.5px solid #111",
                    borderRadius: 999,
                    background: activeLabel === null ? "#111" : "#fff",
                    color: activeLabel === null ? "#fff" : "#111",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  All
                </button>
                {uniqueLabels.map((label) => (
                  <button
                    key={label}
                    onClick={() => setActiveLabel(activeLabel === label ? null : label)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: 1,
                      padding: "3px 8px",
                      border: "1.5px solid #111",
                      borderRadius: 999,
                      background: activeLabel === label ? "#111" : "#fff",
                      color: activeLabel === label ? "#fff" : "#111",
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-4 p-3 overflow-y-auto flex-1">
              {emailsByCategory.map(({ cat, emails }) => {
                if (!emails.length) return null
                const isIgnore = cat === "can_ignore"
                const isOpen = isIgnore ? canIgnoreOpen : true
                return (
                  <div key={cat} className="flex flex-col gap-2">
                    {isIgnore ? (
                      <button
                        onClick={() => setCanIgnoreOpen((v) => !v)}
                        className="flex items-center gap-1 px-1 text-left w-full"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {isOpen
                          ? <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                          : <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {CATEGORY_LABELS[cat]} ({emails.length})
                        </span>
                      </button>
                    ) : (
                      <div
                        className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-1"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {CATEGORY_LABELS[cat]} ({emails.length})
                      </div>
                    )}
                    {isOpen && (
                      isIgnore ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            border: "1.5px solid #E5E5E5",
                            borderRadius: 6,
                            overflow: "hidden",
                          }}
                        >
                          {emails.map((email, i) => {
                            const col = i % 3
                            const isLastRow = i >= emails.length - (emails.length % 3 || 3)
                            return (
                              <button
                                key={email.emailId}
                                onClick={() => setSelectedEmail(email)}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 3,
                                  padding: "7px 8px",
                                  borderRight: col < 2 ? "1px solid #E5E5E5" : "none",
                                  borderBottom: !isLastRow ? "1px solid #E5E5E5" : "none",
                                  background: selectedEmail?.emailId === email.emailId ? "#FFF9ED" : "transparent",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#333",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {email.fromName || email.fromEmail}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: "#999",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontFamily: "var(--font-mono)",
                                  }}
                                >
                                  {email.subject}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        emails.map((email) => (
                          <EmailCard
                            key={email.emailId}
                            email={email}
                            isSelected={selectedEmail?.emailId === email.emailId}
                            onSelect={selectMode ? (e) => {
                              setCheckedIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(e.emailId)) next.delete(e.emailId)
                                else next.add(e.emailId)
                                return next
                              })
                            } : setSelectedEmail}
                            isChecked={selectMode ? checkedIds.has(email.emailId) : undefined}
                            onCheck={selectMode ? (e, checked) => {
                              setCheckedIds((prev) => {
                                const next = new Set(prev)
                                if (checked) next.add(e.emailId)
                                else next.delete(e.emailId)
                                return next
                              })
                            } : undefined}
                          />
                        ))
                      )
                    )}
                  </div>
                )
              })}

              {visibleEmails.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Mail className="size-8 opacity-30" />
                  <p className="text-sm">{activeLabel ? `No emails labeled "${activeLabel}"` : "Inbox is empty"}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="followups" className="flex-1 overflow-y-auto m-0">
            <FollowUpList />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: action panel */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {selectedEmail ? (
          <EmailActionPanel
            email={selectedEmail}
            onReplySent={() => {
              setSelectedEmail(null)
              invalidateInbox()
            }}
            onFollowUpScheduled={() => {
              queryClient.invalidateQueries({ queryKey: qk.vegaFollowUps(organizationId) })
            }}
            onClose={() => setSelectedEmail(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Mail className="size-10 opacity-20" />
            <p className="text-sm">Select an email to see details</p>
          </div>
        )}
      </div>
    </div>
  )
}
