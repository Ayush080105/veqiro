"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import {
  Pencil,
  Calendar,
  Linkedin,
  Twitter,
  Instagram,
  Sparkles,
  FileText,
} from "lucide-react"

import { type ContentItem, type ContentPlatform, type ContentStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CONTENT: ContentItem[] = [
  {
    id: "1",
    platform: "linkedin",
    headline: "Why AI workforces are the future of lean startups",
    content: "Most startups can't afford a full team...",
    status: "published",
    scheduledAt: null,
    createdAt: "2026-04-01T09:00:00Z",
  },
  {
    id: "2",
    platform: "twitter",
    headline: "Ship faster with an AI team behind you 🚀",
    content: "Your AI crew never sleeps...",
    status: "scheduled",
    scheduledAt: "2026-04-03T09:00:00Z",
    createdAt: "2026-04-02T08:00:00Z",
  },
  {
    id: "3",
    platform: "instagram",
    headline: "Behind the build: how we launched in 30 days",
    content: "Thread incoming...",
    status: "draft",
    scheduledAt: null,
    createdAt: "2026-04-02T07:30:00Z",
  },
  {
    id: "4",
    platform: "linkedin",
    headline: "The case for async-first product teams",
    content: "Async isn't just a perk...",
    status: "draft",
    scheduledAt: null,
    createdAt: "2026-04-01T14:00:00Z",
  },
  {
    id: "5",
    platform: "twitter",
    headline: "3 metrics every founder should track weekly",
    content: "MRR, churn, runway...",
    status: "published",
    scheduledAt: null,
    createdAt: "2026-03-30T10:00:00Z",
  },
]

const UPCOMING_POSTS = [
  { platform: "linkedin" as ContentPlatform, date: "Apr 3, 9:00 AM", headline: "Ship faster with an AI team" },
  { platform: "twitter" as ContentPlatform, date: "Apr 4, 11:00 AM", headline: "3 metrics every founder tracks" },
  { platform: "instagram" as ContentPlatform, date: "Apr 5, 2:00 PM", headline: "Behind the build: 30-day launch" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_CONSTRAINTS: Record<ContentPlatform, string> = {
  linkedin: "Max 3,000 chars · Professional tone · 3–5 hashtags",
  twitter: "Max 280 chars · Punchy · 1–3 hashtags",
  instagram: "Max 2,200 chars · Visual-first · 15–30 hashtags",
}

function platformBadge(platform: ContentPlatform) {
  const map: Record<ContentPlatform, { label: string; Icon: React.ElementType }> = {
    linkedin: { label: "LI", Icon: Linkedin },
    twitter: { label: "TW", Icon: Twitter },
    instagram: { label: "IG", Icon: Instagram },
  }
  const { label, Icon } = map[platform]
  return (
    <Badge variant="outline" className="gap-1 font-mono">
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

function statusBadge(status: ContentStatus) {
  const map: Record<ContentStatus, { variant: "outline" | "secondary" | "default"; label: string }> = {
    draft: { variant: "outline", label: "Draft" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    published: { variant: "default", label: "Published" },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── Generate Form Schema ─────────────────────────────────────────────────────

const generateSchema = z.object({
  platform: z.enum(["linkedin", "twitter", "instagram"]),
  topic: z.string().min(3, "Topic is required"),
  tone: z.enum(["professional", "casual", "bold", "technical"]),
})

type GenerateForm = z.infer<typeof generateSchema>

const MOCK_GENERATED: Record<ContentPlatform, string> = {
  linkedin:
    "The future of lean startups isn't hiring faster — it's building smarter. An AI workforce gives you the output of a 10-person team on a 2-person budget. Here's how we're doing it at Veqiro. #AI #Startups #ProductLed",
  twitter:
    "Most founders hire too early. We built an AI team instead. Same output. 1/10th the cost. 🧵 #AIWorkforce #Founders",
  instagram:
    "Behind every great product launch is a team that works around the clock. Ours just happens to be AI. ✨ Here's how we shipped in 30 days with a 2-person crew. Swipe to see the stack. #AI #Startup #BuildInPublic #Founder #Tech #ProductHunt",
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  if (MOCK_CONTENT.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No content yet</p>
          <p className="text-xs text-muted-foreground">
            Generate your first post in the Generate tab.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Platform</TableHead>
            <TableHead className="min-w-48">Headline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_CONTENT.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{platformBadge(item.platform)}</TableCell>
              <TableCell className="max-w-xs">
                <p className="truncate text-xs text-foreground">{item.headline}</p>
              </TableCell>
              <TableCell>{statusBadge(item.status)}</TableCell>
              <TableCell className="text-muted-foreground">
                {item.scheduledAt
                  ? formatDate(item.scheduledAt)
                  : formatDate(item.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" title="Edit">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Schedule">
                    <Calendar className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const [result, setResult] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<ContentPlatform | null>(null)

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: { platform: "linkedin", tone: "professional", topic: "" },
  })

  const watchedPlatform = watch("platform") as ContentPlatform

  function onSubmit(data: GenerateForm) {
    setSelectedPlatform(data.platform as ContentPlatform)
    setResult(MOCK_GENERATED[data.platform as ContentPlatform])
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Generate content</CardTitle>
          <CardDescription>
            Maya will craft platform-optimised copy based on your brand voice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Platform */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Platform</label>
              <Controller
                name="platform"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter / X</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {watchedPlatform && (
                <p className="text-xs text-muted-foreground">
                  {PLATFORM_CONSTRAINTS[watchedPlatform]}
                </p>
              )}
            </div>

            {/* Topic */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Topic</label>
              <input
                {...register("topic")}
                placeholder="What's the topic?"
                className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
              />
              {errors.topic && (
                <p className="text-xs text-destructive">{errors.topic.message}</p>
              )}
            </div>

            {/* Tone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Tone</label>
              <Controller
                name="tone"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <Button type="submit" className="self-start" disabled={isSubmitting}>
              <Sparkles className="size-3.5" />
              {isSubmitting ? "Generating…" : "Generate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && selectedPlatform && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Generated content</CardTitle>
              {platformBadge(selectedPlatform)}
            </div>
            <CardDescription>
              Review, edit, then schedule or copy to your clipboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-none border border-border bg-muted/40 p-3">
              <p className="text-xs/relaxed text-foreground">{result}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm">
                <Calendar className="size-3.5" />
                Schedule
              </Button>
              <Button variant="outline" size="sm">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Content Calendar</CardTitle>
          <CardDescription>
            Content calendar coming soon — your scheduled posts will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {UPCOMING_POSTS.map((post, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-none border border-border px-3 py-2.5"
            >
              {platformBadge(post.platform)}
              <span className="text-xs text-muted-foreground shrink-0">{post.date}</span>
              <span className="truncate text-xs text-foreground">{post.headline}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Brand Voice Tab ──────────────────────────────────────────────────────────

function BrandVoiceTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Brand Voice</CardTitle>
          <CardDescription>
            Your brand voice guides how Maya writes content across every platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current preset:</span>
            <Badge variant="secondary">Professional</Badge>
          </div>
          <p className="text-xs/relaxed text-muted-foreground">
            Your brand voice is configured in the Brain page. Head there to update your tone,
            personality traits, and platform-specific guidelines.
          </p>
          <div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/brain">Edit Brand Voice</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Content Hub</h1>
            <Badge variant="secondary">Powered by Maya</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Create, schedule, and manage content across every platform.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="brand-voice">Brand Voice</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <div className="pt-4">
            <LibraryTab />
          </div>
        </TabsContent>

        <TabsContent value="generate">
          <div className="pt-4">
            <GenerateTab />
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="pt-4">
            <CalendarTab />
          </div>
        </TabsContent>

        <TabsContent value="brand-voice">
          <div className="pt-4">
            <BrandVoiceTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
