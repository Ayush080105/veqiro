"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Archive,
  Clock,
  Mail,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"

import { bulkInboxAction, fetchInbox } from "@/lib/api/vega-inbox"
import { fetchLabels } from "@/lib/api/vega-labels"
import { qk } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"
import { UpgradeRequiredCard } from "@/components/billing/UpgradeRequiredCard"
import { getUpgradeRequiredReason } from "@/components/billing/upgrade-errors"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { EmailActionPanel } from "./EmailActionPanel"
import { EmailCard } from "./EmailCard"
import { FollowUpList } from "./FollowUpList"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

const CATEGORIES = ["reply_now", "action_needed", "fyi", "can_ignore"] as const
type Category = (typeof CATEGORIES)[number]
type MailboxFilter = "all" | "followups" | Category | `label:${string}`

const CATEGORY_LABELS: Record<Category, string> = {
  reply_now: "Reply Now",
  action_needed: "Action Needed",
  fyi: "FYI",
  can_ignore: "Can Ignore",
}

const CATEGORY_COLORS: Record<Category, string> = {
  reply_now: "#F06464",
  action_needed: "#F5C518",
  fyi: "#6FCDE8",
  can_ignore: "#999999",
}

const EMPTY_COUNTS: Record<Category, number> = {
  reply_now: 0,
  action_needed: 0,
  fyi: 0,
  can_ignore: 0,
}

function filterEmails(
  emails: TriagedEmail[],
  mailbox: MailboxFilter,
  search: string
) {
  const normalizedSearch = search.trim().toLowerCase()
  return emails.filter((email) => {
    if (mailbox !== "all") {
      if (mailbox.startsWith("label:")) {
        if (email.label !== mailbox.slice("label:".length)) return false
      } else if (mailbox !== "followups" && email.uiCategory !== mailbox) {
        return false
      }
    }
    if (!normalizedSearch) return true
    const haystack = [
      email.fromName,
      email.fromEmail,
      email.subject,
      email.summary,
      email.snippet,
      email.label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(normalizedSearch)
  })
}

export function InboxView() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const [selectedEmail, setSelectedEmail] = useState<TriagedEmail | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [mailbox, setMailbox] = useState<MailboxFilter>("all")
  const [search, setSearch] = useState("")

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: qk.vegaInbox(organizationId),
    queryFn: ({ meta }) =>
      fetchInbox(30, { force: !!(meta as { force?: boolean } | undefined)?.force }),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000,
  })

  const { data: labels = [], error: labelsError } = useQuery({
    queryKey: qk.vegaLabels(organizationId),
    queryFn: fetchLabels,
    enabled: !!organizationId,
  })

  const emails = data?.emails ?? []
  const visibleEmails = useMemo(
    () => filterEmails(emails, mailbox, search),
    [emails, mailbox, search]
  )

  const selectedVisible = selectedEmail
    ? visibleEmails.some((email) => email.emailId === selectedEmail.emailId)
    : false

  const categoryCounts = useMemo(() => {
    return emails.reduce<Record<Category, number>>(
      (acc, email) => {
        acc[email.uiCategory] += 1
        return acc
      },
      { ...EMPTY_COUNTS }
    )
  }, [emails])

  const labelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    emails.forEach((email) => counts.set(email.label, (counts.get(email.label) ?? 0) + 1))
    return counts
  }, [emails])

  const allVisibleChecked =
    visibleEmails.length > 0 && visibleEmails.every((email) => checkedIds.has(email.emailId))

  useEffect(() => {
    setCheckedIds((prev) => {
      const visibleIds = new Set(visibleEmails.map((email) => email.emailId))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
    if (selectedEmail && !selectedVisible) setSelectedEmail(null)
  }, [visibleEmails, selectedEmail, selectedVisible])

  const invalidateInbox = () =>
    queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })

  const handleForceRefetch = () => {
    void queryClient.fetchQuery({
      queryKey: qk.vegaInbox(organizationId),
      queryFn: () => fetchInbox(30, { force: true }),
      staleTime: 0,
    })
  }

  const handleBulkAction = async (action: "ignore" | "snooze") => {
    if (!checkedIds.size) return
    setBulkPending(true)
    try {
      const snoozeUntil =
        action === "snooze"
          ? new Date(Date.now() + 24 * 3_600_000).toISOString()
          : undefined
      const result = await bulkInboxAction({
        emailIds: Array.from(checkedIds),
        action,
        snoozeUntil,
      })
      toast.success(`Done: ${result.succeeded} emails processed`)
      setCheckedIds(new Set())
      setSelectedEmail(null)
      invalidateInbox()
    } catch {
      toast.error("Bulk action failed")
    } finally {
      setBulkPending(false)
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      visibleEmails.forEach((email) => {
        if (checked) next.add(email.emailId)
        else next.delete(email.emailId)
      })
      return next
    })
  }

  const setMailboxAndReset = (next: MailboxFilter) => {
    setMailbox(next)
    setCheckedIds(new Set())
  }

  const upgradeReason =
    getUpgradeRequiredReason(error) ?? getUpgradeRequiredReason(labelsError)
  if (upgradeReason) {
    return <UpgradeRequiredCard reason={upgradeReason} />
  }

  if (selectedEmail) {
    return (
      <div className="h-full min-h-[560px] bg-[#FFF9ED]">
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
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[560px] flex-col bg-white">
        <div className="border-b-2 border-foreground/15 p-3">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="mx-4 my-3 h-14" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 bg-[#FFF9ED] p-6 text-center">
        <AlertCircle className="size-8 text-destructive opacity-70" />
        <p className="text-sm font-semibold">Could not load Smart Inbox</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Check your Google connection in Settings - Integrations, then try again.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[220px_minmax(0,1fr)] bg-white">
      <aside className="min-h-0 overflow-y-auto border-r-2 border-foreground/15 bg-[#F7F1E4] px-3 py-4">
        <div className="mb-4 flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              mailbox
            </p>
            <p className="truncate font-display text-2xl leading-none">Inbox</p>
          </div>
          <span className="rounded-full border-2 border-foreground bg-white px-2 py-0.5 font-mono text-[10px]">
            {emails.length}
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          <FilterButton
            active={mailbox === "all"}
            label="Inbox"
            count={emails.length}
            onClick={() => setMailboxAndReset("all")}
          />
          <SidebarSection label="Priority" />
          {CATEGORIES.map((category) => (
            <FilterButton
              key={category}
              active={mailbox === category}
              label={CATEGORY_LABELS[category]}
              count={categoryCounts[category]}
              color={CATEGORY_COLORS[category]}
              onClick={() => setMailboxAndReset(category)}
            />
          ))}
          <FilterButton
            active={mailbox === "followups"}
            label="Follow-ups"
            onClick={() => setMailboxAndReset("followups")}
          />
          <SidebarSection label="Labels" />
          {labels.map((label) => (
            <FilterButton
              key={label.id}
              active={mailbox === `label:${label.name}`}
              label={label.name}
              count={labelCounts.get(label.name) ?? 0}
              color={label.color}
              onClick={() => setMailboxAndReset(`label:${label.name}`)}
            />
          ))}
        </nav>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col">
        {mailbox === "followups" ? (
          <>
            <div className="flex h-[58px] items-center justify-between border-b-2 border-foreground/15 px-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  reminders
                </p>
                <p className="text-sm font-semibold">Follow-ups</p>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => refetch()}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FollowUpList />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-[58px] flex-wrap items-center gap-2 border-b-2 border-foreground/15 px-3 py-2">
              <Checkbox
                checked={allVisibleChecked}
                onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                aria-label="Select all visible emails"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleForceRefetch}
                disabled={isFetching}
                title="Refresh inbox"
              >
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
              </Button>
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search mail"
                  className="h-9 rounded-full border-2 border-foreground/25 bg-white pl-9 font-body text-sm"
                />
              </div>
              {checkedIds.size > 0 && (
                <div className="flex items-center gap-1">
                  <span className="mr-1 font-mono text-[10px] text-muted-foreground">
                    {checkedIds.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={bulkPending}
                    onClick={() => handleBulkAction("ignore")}
                  >
                    <Archive className="size-3.5" />
                    Archive
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={bulkPending}
                    onClick={() => handleBulkAction("snooze")}
                  >
                    <Clock className="size-3.5" />
                    Snooze
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {mailbox === "all"
                  ? "All priority mail"
                  : mailbox.startsWith("label:")
                    ? mailbox.slice("label:".length)
                    : CATEGORY_LABELS[mailbox as Category]}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {visibleEmails.length} conversations
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {visibleEmails.map((email) => (
                <EmailCard
                  key={email.emailId}
                  email={email}
                  isSelected={false}
                  isChecked={checkedIds.has(email.emailId)}
                  onSelect={setSelectedEmail}
                  onCheck={(item, checked) => {
                    setCheckedIds((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(item.emailId)
                      else next.delete(item.emailId)
                      return next
                    })
                  }}
                />
              ))}

              {visibleEmails.length === 0 && (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                  <Mail className="size-9 opacity-30" />
                  <p className="text-sm font-medium">
                    {search ? "No emails match your search" : "Nothing in this view"}
                  </p>
                  <p className="max-w-xs text-xs">
                    Refresh Smart Inbox or choose another category from the mailbox rail.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-2 pt-4 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </div>
  )
}

function FilterButton({
  active,
  color,
  label,
  count,
  onClick,
}: {
  active: boolean
  color?: string
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
        active
          ? "border-2 border-foreground bg-[#111] text-[#FFF9ED] shadow-[2px_2px_0_#111]"
          : "border-2 border-transparent text-foreground hover:border-foreground/20 hover:bg-white"
      )}
    >
      {color && (
        <span
          className="size-2.5 shrink-0 rounded-full border border-foreground/30"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="min-w-0 flex-1 truncate font-body">{label}</span>
      {typeof count === "number" && (
        <span className="font-mono text-[10px] opacity-75">{count}</span>
      )}
    </button>
  )
}
