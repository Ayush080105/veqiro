"use client"

import Link from "next/link"
import { Brain } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { authClient } from "@/lib/auth-client"
import { useBrandKit } from "@/lib/api/brain"
import type { BrandKit } from "@/lib/types"

type FieldKey =
  | "companyName"
  | "industry"
  | "brandVoice"
  | "targetAudience"
  | "competitors"
  | "keyDifferentiators"
  | "websiteUrl"

const FIELD_LABELS: Record<FieldKey, string> = {
  companyName: "name",
  industry: "industry",
  brandVoice: "voice",
  targetAudience: "audience",
  competitors: "competitors",
  keyDifferentiators: "differentiators",
  websiteUrl: "website",
}

function filledFields(kit: BrandKit | null | undefined): FieldKey[] {
  if (!kit) return []
  const out: FieldKey[] = []
  if (kit.companyName?.trim()) out.push("companyName")
  if (kit.industry?.trim()) out.push("industry")
  if (kit.brandVoice?.trim()) out.push("brandVoice")
  if (kit.targetAudience?.trim()) out.push("targetAudience")
  if (Array.isArray(kit.competitors) && kit.competitors.length > 0) out.push("competitors")
  if (kit.keyDifferentiators?.trim()) out.push("keyDifferentiators")
  if (kit.websiteUrl?.trim()) out.push("websiteUrl")
  return out
}

function progressColor(pct: number): string {
  return pct >= 30 ? "var(--foreground)" : "var(--destructive)"
}

function ShellHeader() {
  return (
    <div className="mb-3">
      <div className="font-head text-2xl text-foreground">Your brain</div>
      <p className="m-0 mt-1 text-xs text-muted-foreground">Brand context your crew can reuse.</p>
    </div>
  )
}

export function BrandSnapshot() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: kit, isPending } = useBrandKit(organizationId)

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <ShellHeader />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  const isEmpty = !kit || !kit.companyName?.trim()

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
        <ShellHeader />
        <DashboardEmptyState
          icon={Brain}
          title="Brand brain is empty"
          description="Add your voice, audience, differentiators, and website so every agent can stay on brand."
          action={{ label: "Run onboarding", href: "/onboarding" }}
        />
      </div>
    )
  }

  const filled = filledFields(kit)
  const total = 7
  const pct = Math.round((filled.length / total) * 100)
  const missing = (Object.keys(FIELD_LABELS) as FieldKey[]).filter((k) => !filled.includes(k))
  const palette = [
    kit.brandColors?.primary,
    kit.brandColors?.secondary,
    kit.brandColors?.accent,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-1 flex-col rounded-[var(--vq-r)] border border-border bg-card p-5 shadow-[var(--vq-shadow-sm)]">
      <ShellHeader />

      <div className="flex flex-1 flex-col gap-3.5">
        <div>
          <div className="truncate font-head text-xl tracking-tight text-foreground">
            {kit.companyName}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {kit.industry && (
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                {kit.industry}
              </span>
            )}
            {kit.brandVoice && (
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                {kit.brandVoice}
              </span>
            )}
          </div>
        </div>

        {palette.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              Palette
            </div>
            <div className="flex gap-2">
              {palette.map((c, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="h-3 rounded-sm border border-border"
                    style={{ background: c }}
                  />
                  <div className="mt-1 text-center text-[10px] text-muted-foreground">
                    {c}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Completeness</span>
            <span className="font-head text-[12px] text-foreground">
              {filled.length} / {total}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full border border-border bg-muted">
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `scaleX(${pct / 100})`,
                transformOrigin: "left",
                background: progressColor(pct),
                transition: "transform 300ms ease",
              }}
            />
          </div>
        </div>

        {missing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <span
                key={k}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                + {FIELD_LABELS[k]}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex justify-end border-t border-border pt-3.5">
          <Button asChild variant="brand-ghost" size="brand-sm">
            <Link href="/brain">Edit brain</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
