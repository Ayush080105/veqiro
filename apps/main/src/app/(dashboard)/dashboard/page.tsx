"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { RefreshCw } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { useDashboardSummary, ALL_SLUGS, type Range } from "@/lib/api/dashboard"
import { ContentPipeline } from "@/components/dashboard/ContentPipeline"
import { IntegrationHealth } from "@/components/dashboard/IntegrationHealth"
import { CommandCenter } from "@/components/dashboard/CommandCenter"
import { BrandSnapshot } from "@/components/dashboard/BrandSnapshot"
import { MayaUsageCard } from "@/components/dashboard/MayaUsageCard"
import { ValueKpiStrip } from "@/components/dashboard/ValueKpiStrip"
import { ValueReportCard } from "@/components/dashboard/ValueReportCard"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"
import { DashboardProgressBar } from "@/components/dashboard/DashboardProgressBar"
import { ActivityChartSkeleton } from "@/components/dashboard/ActivityChartSkeleton"
import { ContentPipelineSkeleton } from "@/components/dashboard/ContentPipelineSkeleton"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { useHydrated } from "@/lib/hooks/use-hydrated"
import type { AgentSlug } from "@/lib/types"

// Recharts is sizeable. Defer it until the dashboard renders; the skeleton
// occupies the same region so the page does not jump.
const ActivityChart = dynamic(
  () =>
    import("@/components/dashboard/ActivityChart").then((m) => ({
      default: m.ActivityChart,
    })),
  { loading: () => <ActivityChartSkeleton />, ssr: false },
)

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const hydrated = useHydrated()
  const [range, setRange] = useState<Range>({ kind: "7d" })
  const [agents, setAgents] = useState<AgentSlug[]>([...ALL_SLUGS])
  const {
    data: summary,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useDashboardSummary({ range, agents })
  const showSkeletons = isPending && !summary
  const showProgressBar = isFetching && !isPending
  const name = hydrated ? (session?.user?.name?.split(" ")[0] ?? "there") : "there"
  const today = hydrated ? new Date() : null

  const metrics = summary?.metrics
  const activity = summary?.activityChart ?? []
  const pipeline = summary?.contentPipeline ?? {
    byPlatform: { twitter: 0, linkedin: 0, instagram: 0 },
    byStatus: { draft: 0, scheduled: 0, published: 0, failed: 0 },
  }
  return (
    <div className="flex min-w-0 flex-col gap-8 pb-10">
      <DashboardProgressBar active={showProgressBar} />

      <PageHeader
        title="Dashboard"
        subtitle={
          today
            ? `${getGreeting()}, ${name}. ${formatDate(today)}.`
            : "Your AI team, work queue, and business signals in one place."
        }
        size="md"
        
        right={
          <DashboardFilters
            range={range}
            agents={agents}
            onRangeChange={setRange}
            onAgentsChange={setAgents}
          />
        }
      />

      {/* The customer's own business leads the page; Veqiro's activity metrics
          follow below it. Rendered outside the isError branch above because it
          has an entirely separate data source and must survive a failed
          dashboard-summary fetch. */}
      <ValueKpiStrip metrics={metrics} pipeline={pipeline} loading={showSkeletons} />
      <CommandCenter />

      {isError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-body text-sm font-medium text-destructive">
              Dashboard data unavailable
            </div>
            <p className="m-0 mt-1 font-body text-sm leading-snug text-muted-foreground">
              We could not refresh your dashboard summary. Your workspace is still available.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="self-start sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      <ValueReportCard />

      {showSkeletons ? <ActivityChartSkeleton /> : <ActivityChart data={activity} range={range} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <MayaUsageCard />
          {showSkeletons ? <ContentPipelineSkeleton /> : <ContentPipeline data={pipeline} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <IntegrationHealth />
          <BrandSnapshot />
        </div>
      </div>

    </div>
  )
}
