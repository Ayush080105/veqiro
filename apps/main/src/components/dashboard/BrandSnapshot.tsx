"use client"

import Link from "next/link"

import { Skeleton } from "@/components/ui/skeleton"
import { FONT } from "@/components/veqiro/shared"
import { authClient } from "@/lib/auth-client"
import { useBrandKit } from "@/lib/api/brain"
import type { BrandKit } from "@/lib/types"

type FieldKey =
  | "company_name"
  | "industry"
  | "brand_voice"
  | "target_audience"
  | "competitors"
  | "key_differentiators"
  | "website_url"

const FIELD_LABELS: Record<FieldKey, string> = {
  company_name: "name",
  industry: "industry",
  brand_voice: "voice",
  target_audience: "audience",
  competitors: "competitors",
  key_differentiators: "differentiators",
  website_url: "website",
}

function filledFields(kit: BrandKit | null | undefined): FieldKey[] {
  if (!kit) return []
  const out: FieldKey[] = []
  if (kit.company_name?.trim()) out.push("company_name")
  if (kit.industry?.trim()) out.push("industry")
  if (kit.brand_voice?.trim()) out.push("brand_voice")
  if (kit.target_audience?.trim()) out.push("target_audience")
  if (Array.isArray(kit.competitors) && kit.competitors.length > 0)
    out.push("competitors")
  if (kit.key_differentiators?.trim()) out.push("key_differentiators")
  if (kit.website_url?.trim()) out.push("website_url")
  return out
}

function progressColor(pct: number): string {
  if (pct >= 100) return "#1DBC87"
  if (pct >= 30) return "#F5C518"
  return "#F06464"
}

function ShellHeader() {
  return (
    <>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#555",
        }}
      >
        [ brand · at a glance ]
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 26,
          letterSpacing: -0.5,
          color: "#111",
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        your brain
      </div>
    </>
  )
}

export function BrandSnapshot() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const { data: kit, isPending } = useBrandKit(organizationId)

  const shell: React.CSSProperties = {
    background: "#FFF9ED",
    border: "3px solid #111",
    borderRadius: 16,
    boxShadow: "6px 6px 0 #111",
    padding: 20,
  }

  if (isPending) {
    return (
      <div style={shell}>
        <ShellHeader />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  const isEmpty = !kit || !kit.company_name?.trim()

  if (isEmpty) {
    return (
      <div style={shell}>
        <ShellHeader />
        <div
          style={{
            padding: "16px 14px",
            background: "#fff",
            border: "2px dashed #111",
            borderRadius: 10,
            fontFamily: FONT.body,
            fontSize: 13,
            color: "#333",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1, color: "#555" }}>
            {"// no brand kit yet"}
          </span>
          <span>
            Seed your brain via onboarding so your crew knows how to sound.
          </span>
          <Link
            href="/onboarding"
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#EFE7D6",
              textDecoration: "none",
              padding: "8px 12px",
              background: "#111",
              border: "2px solid #111",
              borderRadius: 999,
              boxShadow: "2px 2px 0 #F5C518",
              display: "inline-block",
            }}
          >
            run onboarding →
          </Link>
        </div>
      </div>
    )
  }

  const filled = filledFields(kit)
  const total = 7
  const pct = Math.round((filled.length / total) * 100)
  const missing = (Object.keys(FIELD_LABELS) as FieldKey[]).filter((k) => !filled.includes(k))
  const palette = [
    kit!.brand_colors?.primary,
    kit!.brand_colors?.secondary,
    kit!.brand_colors?.accent,
  ].filter(Boolean) as string[]

  return (
    <div style={shell}>
      <ShellHeader />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* company + industry/voice chips */}
        <div>
          <div
            style={{
              fontFamily: FONT.head,
              fontSize: 20,
              letterSpacing: -0.3,
              color: "#111",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {kit!.company_name}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {kit!.industry && (
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  background: "#6FCDE8",
                  border: "2px solid #111",
                  borderRadius: 999,
                  color: "#111",
                }}
              >
                {kit!.industry}
              </span>
            )}
            {kit!.brand_voice && (
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  background: "#F79FD4",
                  border: "2px solid #111",
                  borderRadius: 999,
                  color: "#111",
                }}
              >
                {kit!.brand_voice}
              </span>
            )}
          </div>
        </div>

        {/* palette */}
        {palette.length > 0 && (
          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#555",
                marginBottom: 6,
              }}
            >
              palette
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {palette.map((c, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 36,
                      background: c,
                      border: "2px solid #111",
                      borderRadius: 6,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      color: "#555",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    {c}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* completeness */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#555",
              marginBottom: 6,
            }}
          >
            <span>completeness</span>
            <span style={{ color: "#111", fontFamily: FONT.head, fontSize: 12 }}>
              {filled.length} / {total}
            </span>
          </div>
          <div
            style={{
              height: 14,
              background: "#fff",
              border: "2.5px solid #111",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
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

        {/* missing pills */}
        {missing.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missing.map((k) => (
              <span
                key={k}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  background: "#FFEFC4",
                  border: "2px solid #B98700",
                  borderRadius: 999,
                  color: "#7A5A00",
                }}
              >
                + {FIELD_LABELS[k]}
              </span>
            ))}
          </div>
        )}

        <div>
          <Link
            href="/brain"
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#111",
              textDecoration: "none",
              padding: "8px 12px",
              background: "#fff",
              border: "2px solid #111",
              borderRadius: 999,
              boxShadow: "2px 2px 0 #111",
              display: "inline-block",
            }}
          >
            edit brain →
          </Link>
        </div>
      </div>
    </div>
  )
}
