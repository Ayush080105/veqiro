"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  if (Array.isArray(kit.competitors) && kit.competitors.length > 0)
    out.push("competitors")
  if (kit.keyDifferentiators?.trim()) out.push("keyDifferentiators")
  if (kit.websiteUrl?.trim()) out.push("websiteUrl")
  return out
}

function progressColor(pct: number): string {
  if (pct >= 100) return "var(--vq-green)"
  if (pct >= 30) return "var(--vq-yellow)"
  return "var(--destructive)"
}

function ShellHeader() {
  return (
    <>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        [ brand - at a glance ]
      </div>
      <div className="font-display text-[26px] tracking-tight text-foreground mt-0.5 mb-3">
        your brain
      </div>
    </>
  )
}

export function BrandSnapshot() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: kit, isPending } = useBrandKit(organizationId)

  if (isPending) {
    return (
      <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
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
      <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
        <ShellHeader />
        <div className="px-3.5 py-4 bg-white border-2 border-dashed border-foreground rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
            {"// no brand kit yet"}
          </span>
          <span>
            Set up your brand kit so your crew knows your voice, tone, and audience.
          </span>
          <Button asChild variant="brand-dark" size="brand-sm">
            <Link href="/onboarding">run onboarding -&gt;</Link>
          </Button>
        </div>
      </div>
    )
  }

  const filled = filledFields(kit)
  const total = 7
  const pct = Math.round((filled.length / total) * 100)
  const missing = (Object.keys(FIELD_LABELS) as FieldKey[]).filter((k) => !filled.includes(k))
  const palette = [
    kit!.brandColors?.primary,
    kit!.brandColors?.secondary,
    kit!.brandColors?.accent,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-card border-[3px] border-foreground rounded-2xl shadow-[6px_6px_0_var(--foreground)] p-5">
      <ShellHeader />

      <div className="flex flex-col gap-3.5">
        {/* Company name + chips */}
        <div>
          <div className="font-head text-xl tracking-tight text-foreground truncate">
            {kit!.companyName}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {kit!.industry && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 border-2 border-foreground rounded-full text-foreground"
                style={{ background: "var(--vq-blue)" }}
              >
                {kit!.industry}
              </span>
            )}
            {kit!.brandVoice && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 border-2 border-foreground rounded-full text-foreground"
                style={{ background: "var(--vq-pink)" }}
              >
                {kit!.brandVoice}
              </span>
            )}
          </div>
        </div>

        {/* Color palette */}
        {palette.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
              palette
            </div>
            <div className="flex gap-2.5">
              {palette.map((c, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="h-9 border-2 border-foreground rounded-md"
                    style={{ background: c }}
                  />
                  <div className="font-mono text-[9px] text-muted-foreground mt-1 text-center">
                    {c}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completeness */}
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            <span>completeness</span>
            <span className="text-foreground font-head text-[12px]">
              {filled.length} / {total}
            </span>
          </div>
          <div className="h-3.5 bg-white border-[2.5px] border-foreground rounded-md overflow-hidden">
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: progressColor(pct),
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>

        {/* Missing field pills */}
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <span
                key={k}
                className="font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                style={{ background: "#FFEFC4", border: "2px solid #B98700", color: "#7A5A00" }}
              >
                + {FIELD_LABELS[k]}
              </span>
            ))}
          </div>
        )}

        <div className="pt-3.5 border-t-2 border-foreground/10 flex justify-end">
          <Button asChild variant="brand-ghost" size="brand-sm">
            <Link href="/brain">edit brain →</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
