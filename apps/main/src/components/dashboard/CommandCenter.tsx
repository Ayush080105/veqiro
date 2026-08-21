"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, Inbox, Plug } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCommandCenter } from "@/lib/api/mcp"

/**
 * What needs you, and what your agents have been doing.
 *
 * This used to carry a strip of live tiles read straight from each connected
 * provider. They were removed deliberately: at fifteen connections one
 * uncached load cost fifteen Composio calls, and a number on a dashboard
 * rarely changes what anyone does — the same question asked of an agent gets a
 * better answer with context.
 *
 * What is left is the part that was always the most useful and happens to cost
 * nothing: the approval queue, which is where triggers and plays deliver their
 * proposals. Every figure here comes from our own database.
 */
export function CommandCenter() {
  const { data, isLoading, isError } = useCommandCenter()

  const pending = data?.pendingActionCount ?? 0
  const connected = data?.connectedCount ?? 0
  const recent = data?.recentActionCount ?? 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Your team</CardTitle>
        <CardDescription className="text-xs">
          {connected === 0
            ? "Connect a tool and your agents can start working in it."
            : `Working across ${connected} connected ${connected === 1 ? "tool" : "tools"}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="text-xs text-destructive">Couldn&apos;t load this right now.</p>
        ) : (
          <>
            {/* The queue leads, because it is the only thing here that needs a
                person. Everything else is reassurance. */}
            {pending > 0 ? (
              <Link
                href="/assistants"
                className="flex items-center justify-between gap-3 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5 hover:bg-[#EFE7D6] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Inbox className="size-4 shrink-0 text-foreground" />
                  <span className="text-xs font-medium">
                    {pending} {pending === 1 ? "action needs" : "actions need"} your approval
                  </span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#D4C9B0] bg-[#FFF9ED] px-3 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-chart-2" />
                <span className="text-xs text-muted-foreground">
                  Nothing waiting on you.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                {recent} {recent === 1 ? "action" : "actions"} in the last 24 hours
              </span>
              <Link href="/settings/usage" className="hover:text-foreground transition-colors">
                See the activity log
              </Link>
              {connected === 0 && (
                <Link
                  href="/settings/integrations"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Plug className="size-3" />
                  Connect a tool
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
