"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronUp, Zap, Bug, Puzzle, Bot, Sparkles, MessageSquare, X } from "lucide-react"
import Link from "next/link"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  useCreateFeedback,
  useSimilarPosts,
  type FeedbackCategory,
} from "@/lib/api/feedback"
import { FONT } from "@/lib/fonts"
import { cn } from "@/lib/utils"

const AGENT_SLUGS = ["vega", "scout", "maya", "sage", "lex", "rex"] as const

const AGENT_COLORS: Record<string, string> = {
  vega: "#6FCDE8",
  scout: "#F5C518",
  maya: "#F06464",
  sage: "#F79FD4",
  lex: "#8A8AF0",
  rex: "#1DBC87",
}

const CATEGORIES: Array<{
  value: FeedbackCategory
  label: string
  description: string
  icon: React.ElementType
  color: string
}> = [
  { value: "FEATURE_REQUEST", label: "Feature Request", description: "A new capability you'd love to see", icon: Zap, color: "#F5C518" },
  { value: "BUG_REPORT", label: "Bug Report", description: "Something isn't working as expected", icon: Bug, color: "#F06464" },
  { value: "INTEGRATION", label: "Integration", description: "Connect with a tool or platform", icon: Puzzle, color: "#8A8AF0" },
  { value: "NEW_AGENT", label: "New Agent", description: "An entirely new AI agent to build", icon: Bot, color: "#1DBC87" },
  { value: "UX_IMPROVEMENT", label: "UX Improvement", description: "Make something easier to use", icon: Sparkles, color: "#6FCDE8" },
  { value: "GENERAL", label: "General", description: "Anything else on your mind", icon: MessageSquare, color: "#F79FD4" },
]

const STATUS_COLORS: Record<string, string> = {
  NEW: "#999",
  UNDER_REVIEW: "#F5C518",
  PLANNED: "#8A8AF0",
  IN_PROGRESS: "#6FCDE8",
  LAUNCHED: "#1DBC87",
  DECLINED: "#F06464",
}

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(["FEATURE_REQUEST", "BUG_REPORT", "INTEGRATION", "NEW_AGENT", "UX_IMPROVEMENT", "GENERAL"] as const),
  agentSlug: z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

interface SubmitFeedbackDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubmitFeedbackDrawer({ open, onOpenChange }: SubmitFeedbackDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const { mutateAsync: createFeedback, isPending } = useCreateFeedback()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: undefined,
      agentSlug: null,
    },
  })

  const titleValue = watch("title") ?? ""

  // Debounce the title by 500 ms so the similar-posts API is not called on every keystroke
  const [debouncedTitle, setDebouncedTitle] = useState(titleValue)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTitle(titleValue), 500)
    return () => clearTimeout(timer)
  }, [titleValue])

  const { data: similarPosts } = useSimilarPosts(debouncedTitle)

  const onSubmit = async (values: FormValues) => {
    await createFeedback({
      title: values.title,
      description: values.description,
      category: selectedCategory ?? values.category,
      agentSlug: selectedAgent,
    })
    reset()
    setSelectedCategory(null)
    setSelectedAgent(null)
    onOpenChange(false)
  }

  const handleClose = () => {
    if (!isPending) {
      reset()
      setSelectedCategory(null)
      setSelectedAgent(null)
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex flex-col sm:max-w-lg overflow-y-auto"
        showCloseButton={false}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b-[3px] border-foreground">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl">Submit Feedback</SheetTitle>
              <SheetDescription className="mt-1">
                Share ideas, report bugs, or request new features.
              </SheetDescription>
            </div>
            <button
              onClick={handleClose}
              className="mt-1 rounded-md border-2 border-foreground p-1.5 hover:bg-muted transition-colors"
              style={{ boxShadow: "2px 2px 0 #111" }}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-6 py-5 flex-1">
            {/* Category selection */}
            <div className="flex flex-col gap-2">
              <Label
                style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}
                className="text-muted-foreground"
              >
                Category <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isSelected = selectedCategory === cat.value
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setSelectedCategory(cat.value)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-md border-[2.5px] border-foreground p-3 text-left transition-all hover:translate-y-px",
                        isSelected
                          ? "shadow-[3px_3px_0_var(--foreground)]"
                          : "shadow-[4px_4px_0_var(--foreground)] hover:shadow-[2px_2px_0_var(--foreground)]"
                      )}
                      style={{
                        background: isSelected ? cat.color : "var(--card)",
                      }}
                    >
                      <Icon className="size-3.5 mt-0.5 shrink-0" />
                      <div>
                        <div
                          style={{ fontFamily: FONT.head, fontSize: 11, lineHeight: 1.2 }}
                          className="font-medium text-foreground uppercase tracking-wide"
                        >
                          {cat.label}
                        </div>
                        <div
                          style={{ fontFamily: FONT.body, fontSize: 10 }}
                          className="text-muted-foreground mt-0.5 leading-snug"
                        >
                          {cat.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {!selectedCategory && errors.category && (
                <p className="text-xs text-destructive">Please select a category</p>
              )}
            </div>

            {/* Agent selection */}
            <div className="flex flex-col gap-2">
              <Label
                style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}
                className="text-muted-foreground"
              >
                Which agent is this about?{" "}
                <span style={{ fontFamily: FONT.mono, fontSize: 10 }}>(optional)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedAgent(null)}
                  className={cn(
                    "rounded-full border-[2px] border-foreground px-3 py-1 text-xs font-head uppercase tracking-wide transition-all",
                    selectedAgent === null
                      ? "bg-foreground text-background shadow-none translate-y-px"
                      : "bg-card shadow-[2px_2px_0_var(--foreground)] hover:translate-y-px hover:shadow-none"
                  )}
                >
                  Platform
                </button>
                {AGENT_SLUGS.map((slug) => {
                  const isSelected = selectedAgent === slug
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setSelectedAgent(isSelected ? null : slug)}
                      className={cn(
                        "rounded-full border-[2px] border-foreground px-3 py-1 text-xs font-head uppercase tracking-wide transition-all",
                        isSelected
                          ? "shadow-none translate-y-px"
                          : "bg-card shadow-[2px_2px_0_var(--foreground)] hover:translate-y-px hover:shadow-none"
                      )}
                      style={{
                        background: isSelected ? AGENT_COLORS[slug] : undefined,
                      }}
                    >
                      {slug}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="feedback-title"
                style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}
                className="text-muted-foreground"
              >
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="feedback-title"
                variant="brand"
                placeholder="Summarize your feedback in a sentence..."
                {...register("title")}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}

              {/* Similar posts */}
              {similarPosts && similarPosts.length > 0 && (
                <div className="mt-1 rounded-md border-[2.5px] border-foreground bg-accent/30 p-3 shadow-[3px_3px_0_var(--foreground)]">
                  <p
                    style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
                    className="text-muted-foreground mb-2"
                  >
                    Similar requests — want to upvote instead?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {similarPosts.slice(0, 3).map((post) => (
                      <Link
                        key={post.id}
                        href={`/feedback/${post.id}`}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center justify-between gap-2 rounded border border-foreground/20 bg-card px-2.5 py-1.5 no-underline hover:bg-muted transition-colors"
                      >
                        <span className="text-xs text-foreground line-clamp-1 flex-1">{post.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide border border-foreground/20"
                            style={{ background: STATUS_COLORS[post.status] + "22", color: STATUS_COLORS[post.status] }}
                          >
                            {post.status.replace("_", " ")}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ChevronUp className="size-3" />
                            {post.voteCount}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="feedback-description"
                style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}
                className="text-muted-foreground"
              >
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback-description"
                variant="brand"
                placeholder="Give us more context. What problem does this solve? What does success look like?"
                rows={4}
                {...register("description")}
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
          </div>

          <SheetFooter className="px-6 pb-6 pt-4 border-t-[3px] border-foreground">
            <Button
              type="button"
              variant="brand-ghost"
              size="brand-sm"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand-dark"
              size="brand-sm"
              disabled={isPending || !selectedCategory}
            >
              {isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
