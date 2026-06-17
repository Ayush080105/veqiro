"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { RefreshCw, Heart, MessageCircle, Share2, Eye, ImageIcon, AlertCircle } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { usePostAnalytics, useRefreshPostAnalytics } from "@/lib/api/assistants"
import type { PostWithAnalytics } from "@/lib/api/assistants"

// ─── Platform config ─────────────────────────────────────────────────────────

const PLATFORM: Record<string, { label: string; color: string; textColor: string }> = {
  LINKEDIN: { label: "LinkedIn", color: "#0077B5", textColor: "#fff" },
  TWITTER: { label: "X / Twitter", color: "#000000", textColor: "#fff" },
  INSTAGRAM: { label: "Instagram", color: "#E1306C", textColor: "#fff" },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="flex flex-col gap-1 border-2 border-[#111] bg-white p-4 min-w-0"
    >
      <div className="flex items-center gap-2 text-[#555]">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-[#111] tabular-nums">{value}</span>
    </div>
  )
}

// ─── Platform stat row ───────────────────────────────────────────────────────

function PlatformRow({
  platform,
  stats,
}: {
  platform: string
  stats: { likes: number; comments: number; shares: number; impressions: number }
}) {
  const cfg = PLATFORM[platform] ?? { label: platform, color: "#888", textColor: "#fff" }
  return (
    <div className="flex items-center gap-4 border-2 border-[#111] bg-white p-3">
      <span
        className="text-xs font-bold px-2 py-0.5 shrink-0"
        style={{ background: cfg.color, color: cfg.textColor }}
      >
        {cfg.label}
      </span>
      <div className="flex gap-5 flex-wrap text-sm text-[#111]">
        <span>
          <span className="font-semibold tabular-nums">{fmt(stats.likes)}</span>{" "}
          <span className="text-[#777]">likes</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums">{fmt(stats.comments)}</span>{" "}
          <span className="text-[#777]">comments</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums">{fmt(stats.shares)}</span>{" "}
          <span className="text-[#777]">shares</span>
        </span>
        {stats.impressions > 0 && (
          <span>
            <span className="font-semibold tabular-nums">{fmt(stats.impressions)}</span>{" "}
            <span className="text-[#777]">impressions</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Post row ────────────────────────────────────────────────────────────────

function PostRow({ post }: { post: PostWithAnalytics }) {
  const cfg = PLATFORM[post.platform] ?? { label: post.platform, color: "#888", textColor: "#fff" }
  const a = post.analytics
  const date = post.publishedAt ?? post.createdAt

  return (
    <div className="grid grid-cols-[56px_1fr_auto] gap-3 border-b border-[#E5E5E5] p-3 items-start last:border-b-0">
      {/* Thumbnail */}
      <div className="border-2 border-[#111] bg-[#F5F5F5] aspect-square overflow-hidden shrink-0 size-14">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="size-5 text-[#bbb]" />
          </div>
        )}
      </div>

      {/* Caption + meta */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
            style={{ background: cfg.color, color: cfg.textColor }}
          >
            {cfg.label}
          </span>
          <span className="text-[11px] text-[#888]">
            {format(parseISO(date), "MMM d, yyyy")}
          </span>
        </div>
        <p className="text-xs text-[#333] line-clamp-2 leading-relaxed">{post.caption}</p>
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-1 text-right shrink-0 min-w-[80px]">
        {a ? (
          <>
            <span className="text-xs text-[#555]">
              <span className="font-semibold text-[#111] tabular-nums">{fmt(a.likes)}</span> likes
            </span>
            <span className="text-xs text-[#555]">
              <span className="font-semibold text-[#111] tabular-nums">{fmt(a.comments)}</span> comments
            </span>
            <span className="text-xs text-[#555]">
              <span className="font-semibold text-[#111] tabular-nums">{fmt(a.shares)}</span> shares
            </span>
            {a.impressions != null && (
              <span className="text-xs text-[#555]">
                <span className="font-semibold text-[#111] tabular-nums">{fmt(a.impressions)}</span> impr.
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-[#aaa]">no data</span>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 p-5 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#E5E5E5] border-2 border-[#ccc]" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-[#E5E5E5] border-2 border-[#ccc]" />
        ))}
      </div>
      <div className="border-2 border-[#ccc] bg-white divide-y divide-[#E5E5E5]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-[#F5F5F5]" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MayaAnalyticsTab() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const { data, isPending } = usePostAnalytics(organizationId)
  const { mutate: refresh, isPending: isRefreshing } = useRefreshPostAnalytics(organizationId)

  const lastFetched = React.useMemo(() => {
    for (const post of data?.posts ?? []) {
      if (post.analytics?.lastFetchedAt) return post.analytics.lastFetchedAt
    }
    return null
  }, [data])

  const unavailable = data?.unavailable ?? []
  const linkedInUnavailable = unavailable.includes("LINKEDIN")
  const instagramUnavailable = unavailable.includes("INSTAGRAM")

  if (isPending) return <Skeleton />

  const { posts = [], totals = { likes: 0, comments: 0, shares: 0, impressions: 0 }, byPlatform = {} } = data ?? {}
  const postsWithAnalytics = posts.filter((p) => p.analytics)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#FFF9ED]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#111] bg-[#FFF9ED] sticky top-0 z-10">
        <div>
          <h2 className="text-sm font-bold text-[#111] tracking-wide">Post Analytics</h2>
          {lastFetched && (
            <p className="text-[11px] text-[#888]">Updated {timeAgo(lastFetched)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 border-2 border-[#111] px-3 py-1.5 text-xs font-medium bg-white hover:bg-[#111] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="flex flex-col gap-5 p-5">
        {/* Platform availability banners */}
        {linkedInUnavailable && (
          <div className="flex items-start gap-3 border-2 border-[#0077B5] bg-[#f0f7ff] p-3">
            <AlertCircle className="size-4 text-[#0077B5] shrink-0 mt-0.5" />
            <p className="text-xs text-[#005a8c]">
              <span className="font-semibold">LinkedIn analytics unavailable.</span>{" "}
              LinkedIn restricts post analytics to approved Marketing Partners only — it cannot be unlocked with standard OAuth. Twitter and Instagram analytics work normally.
            </p>
          </div>
        )}
        {instagramUnavailable && (
          <div className="flex items-start gap-3 border-2 border-[#E1306C] bg-[#fff0f4] p-3">
            <AlertCircle className="size-4 text-[#E1306C] shrink-0 mt-0.5" />
            <p className="text-xs text-[#c0254f]">
              <span className="font-semibold">Instagram analytics unavailable.</span>{" "}
              Reconnect your Instagram account to grant the{" "}
              <code className="font-mono">instagram_business_manage_insights</code> permission.
            </p>
          </div>
        )}

        {/* Empty state */}
        {posts.length === 0 ? (
          <div className="border-2 border-[#111] bg-white p-10 text-center">
            <p className="text-sm text-[#777]">No published posts yet.</p>
            <p className="text-xs text-[#aaa] mt-1">Publish content via Maya to see analytics here.</p>
          </div>
        ) : (
          <>
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Heart className="size-3.5" />} label="Total Likes" value={fmt(totals.likes)} />
              <StatCard icon={<MessageCircle className="size-3.5" />} label="Comments" value={fmt(totals.comments)} />
              <StatCard icon={<Share2 className="size-3.5" />} label="Shares" value={fmt(totals.shares)} />
              <StatCard icon={<Eye className="size-3.5" />} label="Impressions" value={totals.impressions > 0 ? fmt(totals.impressions) : "—"} />
            </div>

            {/* Per-platform breakdown */}
            {Object.keys(byPlatform).length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#555]">By Platform</h3>
                {Object.entries(byPlatform).map(([platform, stats]) => (
                  <PlatformRow key={platform} platform={platform} stats={stats} />
                ))}
              </div>
            )}

            {/* Post table */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#555]">
                Post Performance{" "}
                <span className="font-normal text-[#aaa]">({postsWithAnalytics.length} / {posts.length} tracked)</span>
              </h3>
              <div className="border-2 border-[#111] bg-white divide-y-0">
                {posts.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
