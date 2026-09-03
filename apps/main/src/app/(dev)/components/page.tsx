"use client"

import * as React from "react"
import {
  Briefcase,
  Globe,
  Hash,
  Image as ImageIcon,
  Inbox,
  MessageCircle,
  Sparkles,
} from "lucide-react"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RhfField } from "@/components/forms/RhfField"

// ── Composed ─────────────────────────────────────────────────────────────────
import { ActionRow } from "@/components/ui/action-row"
import { AgentCard } from "@/components/ui/agent-card"
import { AuthCard } from "@/components/ui/auth-card"
import { CollapsibleSection } from "@/components/ui/collapsible-section"
import { CopyButton } from "@/components/ui/copy-button"
import { EmptyState } from "@/components/ui/empty-state"
import { InfoSection } from "@/components/ui/info-section"
import { Kicker } from "@/components/ui/kicker"
import { KpiTile } from "@/components/ui/kpi-tile"
import { PageHeader } from "@/components/ui/page-header"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { StatusPill } from "@/components/ui/status-pill"
import { Sticker } from "@/components/ui/sticker"
import { SubmitButton } from "@/components/ui/submit-button"

// ─────────────────────────────────────────────────────────────────────────────
// Local helpers (showcase only)
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  id,
  kicker,
  title,
  description,
  children,
}: {
  id: string
  kicker: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-12 border-t-2 border-dashed border-foreground/15 px-6 py-12 md:px-12"
    >
      <Kicker prefix="//" tone="ink" size="lg" className="mb-2">
        {kicker}
      </Kicker>
      <h2 className="m-0 font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-none tracking-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  )
}

function Demo({
  label,
  align = "row",
  children,
}: {
  label: string
  align?: "row" | "col" | "grid-2" | "grid-3" | "grid-4"
  children: React.ReactNode
}) {
  const inner = {
    row: "flex flex-wrap items-center gap-3",
    col: "flex flex-col gap-3",
    "grid-2": "grid gap-3 sm:grid-cols-2",
    "grid-3": "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
    "grid-4": "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
  }[align]
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="rounded-md border border-[var(--vq-line)] bg-card/50 p-4">
        <div className={inner}>{children}</div>
      </div>
    </div>
  )
}

const SWATCHES: Array<{ name: string; varName: string }> = [
  { name: "background", varName: "--background" },
  { name: "foreground", varName: "--foreground" },
  { name: "card", varName: "--card" },
  { name: "primary", varName: "--primary" },
  { name: "accent", varName: "--accent" },
  { name: "destructive", varName: "--destructive" },
  { name: "muted-foreground", varName: "--muted-foreground" },
  { name: "vq-green", varName: "--vq-green" },
  { name: "vq-violet", varName: "--vq-violet" },
  { name: "vq-blue", varName: "--vq-blue" },
  { name: "vq-pink", varName: "--vq-pink" },
]

// Sample content used in several sections
const SAMPLE_DRAFT =
  "We just shipped our AI content engine and it's saving the team 8 hours a week. The trick: we stopped writing from scratch and started generating 10 angles, then picking the best 3."

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ComponentsShowcase() {
  // controlled state for interactive demos
  const [platform, setPlatform] = React.useState<"linkedin" | "twitter" | "instagram">("linkedin")
  const [submitDemo, setSubmitDemo] = React.useState(false)

  return (
    <div className="pb-20">
      <header className="relative px-6 py-14 md:px-12">
        <div className="absolute right-8 top-10 hidden md:block">
          <Sticker rotate={-6} tone="yellow">
            dev only
          </Sticker>
        </div>
        <PageHeader
          kicker="design system"
          title="components"
          subtitle={
            "Every primitive and composed block in @/components/ui. Default variants are unchanged shadcn — brand variants are opt-in via variant=\"brand\"."
          }
        />
      </header>

      {/* ── Foundation ────────────────────────────────────────────────────── */}
      <Section
        id="foundation"
        kicker="foundation"
        title="Tokens"
        description="Defined in src/app/globals.css. Every component references these — never hard-code hex."
      >
        <Demo label="Color tokens" align="grid-4">
          {SWATCHES.map((s) => (
            <div
              key={s.varName}
              className="flex items-center gap-3 rounded-md border border-[var(--vq-line)] bg-background p-2.5"
            >
              <span
                className="size-10 shrink-0 rounded-md border border-[var(--vq-line-2)]"
                style={{ background: `var(${s.varName})` }}
              />
              <div className="min-w-0">
                <div className="text-xs font-medium">{s.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {s.varName}
                </div>
              </div>
            </div>
          ))}
        </Demo>

        <Demo label="Font stacks" align="col">
          <div className="font-display text-3xl">
            font-display — bagel fat one — “welcome back”
          </div>
          <div className="font-head text-xl uppercase tracking-wider">
            font-head — archivo black — VEQIRO
          </div>
          <div className="font-body text-base">
            font-body — Space Grotesk — the quick brown fox jumps over the lazy dog
          </div>
          <div className="font-mono text-sm">
            font-mono — JetBrains Mono — // {"a flat structure with"} 0.18em tracking
          </div>
        </Demo>
      </Section>

      {/* ── Button ───────────────────────────────────────────────────────── */}
      <Section
        id="buttons"
        kicker="primitives"
        title="Button"
        description='Existing variants (default, outline, secondary, ghost, destructive, link) and existing sizes are unchanged. New variants prefixed "brand-*" and a "brand" size carry the chunky CTA look.'
      >
        <Demo label="Default variants — small refined">
          <Button>default</Button>
          <Button variant="outline">outline</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="destructive">destructive</Button>
          <Button variant="link">link</Button>
        </Demo>

        <Demo label="Default sizes">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>default</Button>
          <Button size="lg">lg</Button>
        </Demo>

        <Demo label='Brand variants — chunky CTA (size="brand")'>
          <Button variant="brand" size="brand">primary action</Button>
          <Button variant="brand-dark" size="brand">dark cta</Button>
          <Button variant="brand-yellow" size="brand">yellow cta</Button>
          <Button variant="brand-ghost" size="brand">ghost</Button>
        </Demo>

        <Demo label="Brand sizes">
          <Button variant="brand" size="brand-sm">brand-sm</Button>
          <Button variant="brand" size="brand">brand</Button>
          <Button variant="brand" size="brand-lg">brand-lg</Button>
        </Demo>

        <Demo label="Disabled">
          <Button variant="brand" size="brand" disabled>disabled</Button>
          <Button variant="brand-dark" size="brand" disabled>disabled</Button>
          <Button variant="outline" disabled>disabled</Button>
        </Demo>
      </Section>

      {/* ── SubmitButton ─────────────────────────────────────────────────── */}
      <Section
        id="submit-button"
        kicker="composed"
        title="SubmitButton"
        description="Wraps Button. Defaults to variant=brand size=brand. Pass isLoading + loadingText for the spinner."
      >
        <Demo label="Idle vs loading">
          <SubmitButton className="w-fit">submit</SubmitButton>
          <SubmitButton isLoading loadingText="Saving…" className="w-fit">
            submit
          </SubmitButton>
          <SubmitButton variant="brand-dark" isLoading={submitDemo} loadingText="Working…" onClick={() => {
            setSubmitDemo(true)
            setTimeout(() => setSubmitDemo(false), 1500)
          }} className="w-fit">
            click me
          </SubmitButton>
        </Demo>
      </Section>

      {/* ── Input / Textarea ─────────────────────────────────────────────── */}
      <Section
        id="inputs"
        kicker="primitives"
        title="Input · Textarea"
        description='Default = compact shadcn. Brand = chunky 3px ink border, cream bg, body font, focus shadow.'
      >
        <Demo label="Input — default" align="col">
          <Input placeholder="Search…" />
          <Input type="email" placeholder="name@example.com" />
        </Demo>
        <Demo label="Input — brand" align="col">
          <Input variant="brand" placeholder="Search…" />
          <Input variant="brand" type="email" placeholder="name@example.com" />
          <Input variant="brand" placeholder="aria-invalid example" aria-invalid />
        </Demo>
        <Demo label="Textarea — default" align="col">
          <Textarea placeholder="Notes…" />
        </Demo>
        <Demo label="Textarea — brand" align="col">
          <Textarea variant="brand" placeholder="Tell us about your brand voice…" />
        </Demo>
      </Section>

      {/* ── Field (shadcn primitive composition) ────────────────────────── */}
      <Section
        id="field"
        kicker="primitives"
        title="Field · FieldDescription · FieldError"
        description="Existing shadcn primitives — pair with Label variant=brand and Input variant=brand for forms."
      >
        <Demo label="Brand form field" align="col">
          <div className="max-w-sm">
            <Field>
              <Label htmlFor="email-demo" variant="brand">Email</Label>
              <Input
                id="email-demo"
                variant="brand"
                type="email"
                placeholder="name@example.com"
              />
              <FieldDescription>
                We will send a verification link.
              </FieldDescription>
            </Field>
          </div>
        </Demo>
        <Demo label="With error" align="col">
          <div className="max-w-sm">
            <Field>
              <Label htmlFor="pwd-demo" variant="brand">Password</Label>
              <Input
                id="pwd-demo"
                variant="brand"
                type="password"
                placeholder="••••••••"
                aria-invalid
              />
              <FieldError>Password must be at least 8 characters</FieldError>
            </Field>
          </div>
        </Demo>
      </Section>

      {/* ── RhfField (RHF + zod + Field composition) ─────────────────────── */}
      <RhfFieldDemoSection />

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <Section
        id="card"
        kicker="primitives"
        title="Card"
        description='Default = clean shadcn surface. Brand = cream + 3px ink border + 5px hard offset shadow.'
      >
        <Demo label="Default" align="grid-2">
          <Card>
            <CardHeader>
              <CardTitle>Default card</CardTitle>
            </CardHeader>
            <CardContent>Content sits on the standard shadcn cream surface.</CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Compact</CardTitle>
            </CardHeader>
            <CardContent>size=&quot;sm&quot; reduces padding.</CardContent>
          </Card>
        </Demo>
        <Demo label="Brand" align="grid-2">
          <Card variant="brand">
            <CardHeader>
              <CardTitle className="font-display text-2xl tracking-tight">
                brand card
              </CardTitle>
            </CardHeader>
            <CardContent className="font-body">
              Cream bg, 3px ink border, 5px hard offset shadow. The hero surface.
            </CardContent>
          </Card>
          <Card variant="brand" size="sm">
            <CardHeader>
              <CardTitle className="font-display text-xl tracking-tight">
                small brand card
              </CardTitle>
            </CardHeader>
            <CardContent className="font-body">Tighter spacing.</CardContent>
          </Card>
        </Demo>
      </Section>

      {/* ── Label · Kicker ───────────────────────────────────────────────── */}
      <Section
        id="label"
        kicker="primitives"
        title="Label · Kicker"
      >
        <Demo label="Label variants" align="col">
          <Label>default — sits inline with form controls</Label>
          <Label variant="kicker">kicker — mono uppercase eyebrow</Label>
          <Label variant="brand">brand — chunky form label</Label>
        </Demo>
        <Demo label="Kicker sizes & tones">
          <Kicker size="sm">small</Kicker>
          <Kicker>medium</Kicker>
          <Kicker size="lg">large</Kicker>
          <Kicker tone="ink">ink tone</Kicker>
          <Kicker prefix="[" tone="ink">bracket ]</Kicker>
          <Kicker prefix={null} tone="ink">no prefix</Kicker>
        </Demo>
      </Section>

      {/* ── Badge ────────────────────────────────────────────────────────── */}
      <Section
        id="badge"
        kicker="primitives"
        title="Badge"
      >
        <Demo label="Default variants">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="ghost">ghost</Badge>
          <Badge variant="link">link</Badge>
        </Demo>
        <Demo label="Brand pills (sticker-style)">
          <Badge variant="brand">brand</Badge>
          <Badge variant="brand-red">brand-red</Badge>
          <Badge variant="brand-dark">brand-dark</Badge>
          <Badge variant="brand-mono">brand-mono</Badge>
        </Demo>
      </Section>

      {/* ── Sticker ──────────────────────────────────────────────────────── */}
      <Section
        id="sticker"
        kicker="composed"
        title="Sticker"
        description="Hand-drawn rotating pill. Pure decoration. rotate prop sets degrees."
      >
        <Demo label="Tones at varied rotations">
          <Sticker tone="yellow" rotate={-6}>yellow</Sticker>
          <Sticker tone="red" rotate={4}>red</Sticker>
          <Sticker tone="green" rotate={-2}>green</Sticker>
          <Sticker tone="violet" rotate={6}>violet</Sticker>
          <Sticker tone="blue" rotate={-4}>blue</Sticker>
          <Sticker tone="pink" rotate={2}>pink</Sticker>
          <Sticker tone="cream" rotate={0}>cream</Sticker>
        </Demo>
      </Section>

      {/* ── PageHeader ──────────────────────────────────────────────────── */}
      <Section
        id="page-header"
        kicker="composed"
        title="PageHeader"
        description="Display-font title with optional kicker + subtitle + sticker + right slot."
      >
        <Demo label="Large (page hero)" align="col">
          <PageHeader
            kicker="dashboard"
            title="welcome back"
            subtitle="Your six AI employees are ready. Here's what they shipped while you slept."
            sticker={<Sticker tone="yellow" rotate={-4}>v1.0</Sticker>}
            right={<Button variant="brand" size="brand-sm">new task</Button>}
          />
        </Demo>
        <Demo label="Medium (section heading)" align="col">
          <PageHeader
            size="md"
            kicker="settings"
            title="integrations"
            subtitle="Connect Maya to your social accounts."
          />
        </Demo>
      </Section>

      {/* ── AuthCard ─────────────────────────────────────────────────────── */}
      <Section
        id="auth-card"
        kicker="composed"
        title="AuthCard"
        description="Brand cream card with optional sticker. Compound: AuthCard.Header / AuthCard.Footer."
      >
        <Demo label="Login flow example" align="col">
          <AuthCard sticker={<Sticker rotate={-6} tone="yellow">login</Sticker>}>
            <AuthCard.Header
              kicker="sign in to your crew"
              title="welcome back"
            />
            <form className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="auth-email" variant="brand">Email</Label>
                <Input id="auth-email" variant="brand" type="email" placeholder="name@example.com" />
              </Field>
              <Field>
                <Label htmlFor="auth-pwd" variant="brand">Password</Label>
                <Input id="auth-pwd" variant="brand" type="password" placeholder="••••••••" />
              </Field>
              <SubmitButton>Login</SubmitButton>
            </form>
            <AuthCard.Footer>
              Don&apos;t have an account? <a href="#" className="font-head uppercase tracking-wider underline">Sign up</a>
            </AuthCard.Footer>
          </AuthCard>
        </Demo>
      </Section>

      {/* ── AgentCard ───────────────────────────────────────────────────── */}
      <Section
        id="agent-card"
        kicker="composed"
        title="AgentCard"
        description="Compound card for agent results: AgentCard.Header / Body / Footer. Use variant=brand for hero cards."
      >
        <Demo label="Default — agent result list item" align="grid-2">
          <AgentCard>
            <AgentCard.Header
              icon={<Sparkles />}
              title="Content ideas"
              badge={<Badge variant="secondary">3 ideas</Badge>}
            />
            <AgentCard.Body>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                3 LinkedIn post ideas about onboarding friction, with predicted engagement.
              </p>
            </AgentCard.Body>
            <AgentCard.Footer>
              <ActionRow copy={{ text: SAMPLE_DRAFT, label: "Copy ideas" }} />
            </AgentCard.Footer>
          </AgentCard>

          <AgentCard variant="brand">
            <AgentCard.Header
              kicker="// new"
              icon={<Sparkles />}
              title="Brand draft ready"
              badge={<StatusPill level="ok">ready</StatusPill>}
            />
            <AgentCard.Body>
              <p className="font-body text-sm leading-relaxed">
                {SAMPLE_DRAFT}
              </p>
            </AgentCard.Body>
            <AgentCard.Footer>
              <ActionRow copy={{ text: SAMPLE_DRAFT }}>
                <Button variant="brand" size="brand-sm">
                  Publish
                </Button>
              </ActionRow>
            </AgentCard.Footer>
          </AgentCard>
        </Demo>
      </Section>

      {/* ── KpiTile ─────────────────────────────────────────────────────── */}
      <Section
        id="kpi-tile"
        kicker="composed"
        title="KpiTile"
        description="Single canonical small-stat tile. tone × shape grid."
      >
        <Demo label="Default shape" align="grid-4">
          <KpiTile label="MRR" value="$24.8k" delta={{ value: "+12.3%", trend: "up" }} />
          <KpiTile label="Users" value="1,284" suffix="active" tone="muted" />
          <KpiTile label="Churn" value="2.1%" delta={{ value: "-0.4%", trend: "down" }} />
          <KpiTile label="NPS" value="71" delta={{ value: "0", trend: "flat" }} />
        </Demo>
        <Demo label="Brand shape (chunky)" align="grid-3">
          <KpiTile shape="brand" label="MRR" value="$24.8k" delta={{ value: "+12.3%", trend: "up" }} />
          <KpiTile shape="brand" tone="accent" label="Goal" value="80%" suffix="of Q2" />
          <KpiTile shape="brand" tone="ink" label="Today" value="42" suffix="actions" delta={{ value: "+8", trend: "up" }} />
        </Demo>
      </Section>

      {/* ── InfoSection ─────────────────────────────────────────────────── */}
      <Section
        id="info-section"
        kicker="composed"
        title="InfoSection"
        description="Kicker + content. Pass markdown, items, or arbitrary children."
      >
        <Demo label="Markdown body" align="col">
          <InfoSection
            label="synthesis"
            markdown="The team shipped 3 features and 12 bug fixes this week. Velocity is up 22% over the previous sprint, mostly from cycle-time improvements in the review queue."
          />
        </Demo>
        <Demo label="Items list" align="col">
          <InfoSection
            label="anomalies"
            items={[
              { title: "Signup conversion dropped 8%", subtitle: "since 2026-04-22", meta: "high" },
              { title: "Twitter post engagement spike", subtitle: "viral thread", meta: "ok" },
              { title: "API latency p95 +120ms", subtitle: "after 14:30", meta: "watch" },
            ]}
          />
        </Demo>
      </Section>

      {/* ── CollapsibleSection ──────────────────────────────────────────── */}
      <Section
        id="collapsible-section"
        kicker="composed"
        title="CollapsibleSection"
      >
        <Demo label="Open + closed" align="col">
          <CollapsibleSection
            title="Cluster: founder onboarding"
            subtitle="12 keywords, 4 with high intent"
            badge={<Badge variant="secondary">12</Badge>}
            defaultOpen
          >
            <ul className="m-0 grid grid-cols-2 gap-1 p-0 font-mono text-[11px] text-foreground/80">
              {[
                "founder onboarding",
                "saas onboarding",
                "first run experience",
                "onboarding friction",
                "activation rate",
                "time to value",
              ].map((k) => (
                <li key={k} className="list-none border-l-2 border-foreground/30 pl-2">
                  {k}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
          <CollapsibleSection
            title="Cluster: AI productivity"
            subtitle="8 keywords"
            badge={<Badge variant="secondary">8</Badge>}
          >
            <p className="text-[12px] text-muted-foreground">closed by default — click to expand.</p>
          </CollapsibleSection>
        </Demo>
      </Section>

      {/* ── SegmentedGroup ──────────────────────────────────────────────── */}
      <Section
        id="segmented-group"
        kicker="composed"
        title="SegmentedGroup"
        description="Single-select horizontal pill group. Wraps shadcn ToggleGroup."
      >
        <Demo label="Platform picker" align="col">
          <SegmentedGroup
            label="platform"
            value={platform}
            onValueChange={(v) => setPlatform(v)}
            options={[
              { value: "linkedin", label: "LinkedIn", icon: <Briefcase className="size-3.5" /> },
              { value: "twitter", label: "X / Twitter", icon: <MessageCircle className="size-3.5" /> },
              { value: "instagram", label: "Instagram", icon: <ImageIcon className="size-3.5" /> },
            ]}
          />
          <span className="font-mono text-[11px] text-muted-foreground">selected: {platform}</span>
        </Demo>
      </Section>

      {/* ── CopyButton ───────────────────────────────────────────────────── */}
      <Section
        id="copy-button"
        kicker="composed"
        title="CopyButton"
        description="Clipboard + sonner toast + 2s success state."
      >
        <Demo label="Modes">
          <CopyButton text={SAMPLE_DRAFT} />
          <CopyButton text={SAMPLE_DRAFT} label="Copy draft" />
          <CopyButton text={SAMPLE_DRAFT} iconOnly />
          <CopyButton text={SAMPLE_DRAFT} variant="brand" size="brand-sm" />
        </Demo>
      </Section>

      {/* ── ActionRow ───────────────────────────────────────────────────── */}
      <Section
        id="action-row"
        kicker="composed"
        title="ActionRow"
        description="Standard flex row holding Copy + Download + custom slots."
      >
        <Demo label="Combinations" align="col">
          <ActionRow copy={{ text: SAMPLE_DRAFT, label: "Copy" }} />
          <ActionRow
            copy={{ text: SAMPLE_DRAFT }}
            download={{ href: "#", name: "draft.txt", label: "Download" }}
          />
          <ActionRow copy={{ text: SAMPLE_DRAFT }}>
            <Button variant="brand-dark" size="brand-sm">Publish</Button>
          </ActionRow>
        </Demo>
      </Section>

      {/* ── EmptyState ───────────────────────────────────────────────────── */}
      <Section
        id="empty-state"
        kicker="composed"
        title="EmptyState"
      >
        <Demo label="Card tone (default)" align="col">
          <EmptyState
            icon={<Inbox />}
            title="No assistants yet"
            description="Hire one of the six AI employees to start populating your dashboard."
            action={{ label: "Hire your first", href: "#" }}
          />
        </Demo>
        <Demo label="Plain tone (inline)" align="col">
          <EmptyState
            tone="plain"
            icon={<Hash />}
            title="No tags"
            description="This document has no tags yet."
          />
        </Demo>
      </Section>

      {/* ── StatusPill ───────────────────────────────────────────────────── */}
      <Section
        id="status-pill"
        kicker="composed"
        title="StatusPill"
        description="Compact pill with leading icon. Levels: info / ok / warn / danger."
      >
        <Demo label="All levels">
          <StatusPill level="info">info</StatusPill>
          <StatusPill level="ok">ready</StatusPill>
          <StatusPill level="warn">attention</StatusPill>
          <StatusPill level="danger">blocked</StatusPill>
        </Demo>
        <Demo label="Custom icon / no icon">
          <StatusPill level="info" icon={<Globe className="size-3" />}>worldwide</StatusPill>
          <StatusPill level="ok" icon={null}>icon-less</StatusPill>
        </Demo>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RhfField demo (RHF + zod + shadcn Field composition)
// ─────────────────────────────────────────────────────────────────────────────

const demoSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8, "Confirm your password"),
    bio: z
      .string()
      .min(10, "At least 10 characters")
      .max(80, "Keep it under 80 characters"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

type DemoValues = z.infer<typeof demoSchema>

function RhfFieldDemoSection() {
  const form = useForm<DemoValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { email: "", password: "", confirm: "", bio: "" },
    mode: "onBlur",
  })

  const onSubmit = (data: DemoValues) => {
    console.log("Demo submit:", data)
  }

  return (
    <Section
      id="rhf-field"
      kicker="composed"
      title="RhfField"
      description="Single Controller wrapper for the RHF + zod + shadcn-Field pattern. Renders Field > Label (brand) > children > description | error."
    >
      <Demo label="Live form (try invalid input + tab away)">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-md flex-col gap-4"
        >
          <FieldGroup>
            <RhfField
              control={form.control}
              name="email"
              label="Email"
              required
            >
              {({ field, invalid, id }) => (
                <Input
                  {...field}
                  id={id}
                  type="email"
                  variant="brand"
                  placeholder="you@example.com"
                  aria-invalid={invalid}
                />
              )}
            </RhfField>

            <RhfField
              control={form.control}
              name="password"
              label="Password"
              description="Must be at least 8 characters."
              required
            >
              {({ field, invalid, id }) => (
                <Input
                  {...field}
                  id={id}
                  type="password"
                  variant="brand"
                  aria-invalid={invalid}
                />
              )}
            </RhfField>

            <RhfField
              control={form.control}
              name="confirm"
              label="Confirm password"
              required
            >
              {({ field, invalid, id }) => (
                <Input
                  {...field}
                  id={id}
                  type="password"
                  variant="brand"
                  aria-invalid={invalid}
                />
              )}
            </RhfField>

            <RhfField
              control={form.control}
              name="bio"
              label="One-line bio"
              description="10-80 characters."
            >
              {({ field, invalid, id }) => (
                <Textarea
                  {...field}
                  id={id}
                  variant="brand"
                  rows={2}
                  aria-invalid={invalid}
                />
              )}
            </RhfField>

            <Button
              type="submit"
              variant="brand"
              size="brand"
              disabled={form.formState.isSubmitting}
            >
              Submit
            </Button>
          </FieldGroup>
        </form>
      </Demo>
    </Section>
  )
}
