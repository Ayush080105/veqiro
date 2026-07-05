"use client"

import * as React from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
  isToday,
} from "date-fns"
import { ChevronLeft, ChevronRight, ImageIcon, ExternalLink, X } from "lucide-react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { usePublishedPosts, useCancelScheduledPost } from "@/lib/api/assistants"
import type { PublishedPost } from "@/lib/api/assistants"

// ─── Platform config ─────────────────────────────────────────────────────────

const PLATFORM: Record<string, { label: string; color: string; dot: string }> = {
  LINKEDIN: { label: "LinkedIn", color: "#0077B5", dot: "bg-[#0077B5]" },
  TWITTER: { label: "X / Twitter", color: "#000000", dot: "bg-[#000000]" },
  INSTAGRAM: { label: "Instagram", color: "#E1306C", dot: "bg-[#E1306C]" },
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function postDate(p: PublishedPost): Date {
  return parseISO(p.publishedAt ?? p.scheduledAt ?? p.createdAt)
}

function groupByDay(posts: PublishedPost[]): Map<string, PublishedPost[]> {
  const map = new Map<string, PublishedPost[]>()
  for (const p of posts) {
    const key = format(postDate(p), "yyyy-MM-dd")
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return map
}

function calendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  const days: Date[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: PublishedPost }) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const cancelScheduledPost = useCancelScheduledPost(organizationId)

  const cfg = PLATFORM[post.platform] ?? { label: post.platform, color: "#888", dot: "bg-gray-400" }
  const date = postDate(post)
  const isSuccess = post.status === "success"
  const isFailed = post.status === "failed"
  const isScheduled = post.status === "scheduled"
  const isCancelled = post.status === "cancelled"

  const handleCancel = () => {
    cancelScheduledPost.mutate(post.id, {
      onSuccess: () => toast.success("Scheduled post cancelled"),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div
      style={{ borderColor: "#111" }}
      className="border-2 rounded-none bg-white overflow-hidden"
    >
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square bg-[#f5f0e8] flex items-center justify-center">
          <ImageIcon className="size-8 text-[#bbb]" />
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* platform + time row */}
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 text-white"
            style={{ background: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-[#666]">
            {isScheduled ? `Scheduled ${format(date, "h:mm a")}` : format(date, "h:mm a")}
          </span>
        </div>

        {/* caption */}
        <p className={`text-xs text-[#111] line-clamp-3 leading-relaxed ${isCancelled ? "line-through text-[#999]" : ""}`}>
          {post.caption}
        </p>

        {/* hashtags */}
        {post.hashtags.length > 0 && (
          <p className="text-[10px] text-[#0077B5] truncate">
            {post.hashtags.slice(0, 5).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            {post.hashtags.length > 5 && ` +${post.hashtags.length - 5}`}
          </p>
        )}

        {/* error message */}
        {isFailed && post.error && (
          <p className="text-[10px] text-red-600 line-clamp-2" title={post.error}>
            {post.error}
          </p>
        )}

        {/* status + link row */}
        <div className="flex items-center justify-between pt-0.5">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 border ${
              isSuccess
                ? "border-green-600 text-green-700 bg-green-50"
                : isFailed
                ? "border-red-500 text-red-600 bg-red-50"
                : isScheduled
                ? "border-blue-500 text-blue-700 bg-blue-50"
                : isCancelled
                ? "border-gray-400 text-gray-500 bg-gray-50"
                : "border-yellow-500 text-yellow-700 bg-yellow-50"
            }`}
          >
            {isSuccess
              ? "Published"
              : isFailed
              ? "Failed"
              : isScheduled
              ? "Scheduled"
              : isCancelled
              ? "Cancelled"
              : "Pending"}
          </span>
          {isScheduled && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelScheduledPost.isPending}
              className="flex items-center gap-0.5 text-[10px] text-[#666] hover:text-red-600 disabled:opacity-60"
              title="Cancel scheduled post"
            >
              <X className="size-3" /> Cancel
            </button>
          )}
          {!isScheduled && post.platformPostId && (
            <a
              href={`#`}
              className="flex items-center gap-0.5 text-[10px] text-[#666] hover:text-[#111]"
              title="View on platform"
            >
              View <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MayaPublishedPostsTab() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: posts = [], isPending } = usePublishedPosts(organizationId)

  const [month, setMonth] = React.useState(() => new Date())
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null)

  const byDay = React.useMemo(() => groupByDay(posts), [posts])
  const days = React.useMemo(() => calendarDays(month), [month])

  const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null
  const selectedPosts = selectedKey ? (byDay.get(selectedKey) ?? []) : []

  // Auto-select today if it has posts, else first day with posts in current month
  React.useEffect(() => {
    if (selectedDay) return
    const todayKey = format(new Date(), "yyyy-MM-dd")
    if (byDay.has(todayKey)) {
      setSelectedDay(new Date())
      return
    }
    for (const day of days) {
      if (!isSameMonth(day, month)) continue
      const k = format(day, "yyyy-MM-dd")
      if (byDay.has(k)) {
        setSelectedDay(day)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDay, month])

  const totalThisMonth = days.reduce((acc, d) => {
    if (!isSameMonth(d, month)) return acc
    return acc + (byDay.get(format(d, "yyyy-MM-dd"))?.length ?? 0)
  }, 0)

  return (
    <div className="flex flex-col h-full bg-[#FFF9ED]">
      {/* Month header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b-2 border-[#111]"
        style={{ background: "#FFF9ED" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setMonth((m) => subMonths(m, 1)); setSelectedDay(null) }}
            className="border-2 border-[#111] p-1 hover:bg-[#111] hover:text-white transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-bold tracking-wide text-[#111]">
            {format(month, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => { setMonth((m) => addMonths(m, 1)); setSelectedDay(null) }}
            className="border-2 border-[#111] p-1 hover:bg-[#111] hover:text-white transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <span className="text-xs text-[#666]">
          {totalThisMonth} post{totalThisMonth !== 1 ? "s" : ""} this month
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex flex-col flex-1 min-w-0 border-r-2 border-[#111] overflow-y-auto">
          {/* Day labels */}
          <div className="grid grid-cols-7 border-b-2 border-[#111]">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold uppercase tracking-wide text-[#666] py-2 border-r border-[#ddd] last:border-r-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-[#ddd] last:border-b-0">
              {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                const key = format(day, "yyyy-MM-dd")
                const dayPosts = byDay.get(key) ?? []
                const inMonth = isSameMonth(day, month)
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                const today = isToday(day)

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex flex-col items-start p-1.5 min-h-[72px] border-r border-[#ddd] last:border-r-0 text-left transition-colors
                      ${isSelected ? "bg-[#111]" : inMonth ? "hover:bg-[#f5edd8]" : ""}
                    `}
                  >
                    {/* Date number */}
                    <span
                      className={`text-xs font-bold mb-1 w-5 h-5 flex items-center justify-center
                        ${today && !isSelected ? "bg-[#111] text-white rounded-full" : ""}
                        ${isSelected ? "text-white" : inMonth ? "text-[#111]" : "text-[#bbb]"}
                      `}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Post thumbnails / dots */}
                    {dayPosts.length > 0 && inMonth && (
                      <div className="flex flex-wrap gap-0.5 w-full">
                        {dayPosts.slice(0, 3).map((p) => {
                          const cfg = PLATFORM[p.platform]
                          return p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={p.id}
                              src={p.imageUrl}
                              alt=""
                              className="w-7 h-7 object-cover border border-[#111]"
                            />
                          ) : (
                            <span
                              key={p.id}
                              className={`w-3 h-3 rounded-full ${cfg?.dot ?? "bg-gray-400"} ${isSelected ? "opacity-90" : ""}`}
                            />
                          )
                        })}
                        {dayPosts.length > 3 && (
                          <span className={`text-[9px] font-bold ${isSelected ? "text-white" : "text-[#666]"}`}>
                            +{dayPosts.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {isPending && (
            <div className="py-8 text-center text-xs text-[#888]">Loading…</div>
          )}
        </div>

        {/* Side panel — selected day posts */}
        <div className="w-72 flex flex-col flex-shrink-0 overflow-y-auto">
          {selectedDay ? (
            <>
              <div className="sticky top-0 px-4 py-3 border-b-2 border-[#111] bg-[#FFF9ED] z-10">
                <p className="text-xs font-bold text-[#111]">
                  {format(selectedDay, "EEEE, MMMM d")}
                </p>
                <p className="text-[10px] text-[#666]">
                  {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""}
                </p>
              </div>

              {selectedPosts.length > 0 ? (
                <div className="p-3 space-y-3">
                  {selectedPosts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                  <p className="text-xs text-[#888]">No posts on this day.</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <p className="text-xs text-[#888]">Select a day to see posts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
