"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  EyeOff,
} from "lucide-react"

import { PageHeader } from "@/components/ui/page-header"
import { SettingsNav } from "@/components/settings/SettingsNav"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  useAdminFeedbackList,
  useUpdateFeedbackStatus,
  useUpcomingAgents,
  useCreateUpcomingAgent,
  useUpdateUpcomingAgent,
  useDeleteUpcomingAgent,
  type FeedbackPost,
  type FeedbackStatus,
  type UpcomingAgent,
} from "@/lib/api/feedback"

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  NEW:          { label: "New",          variant: "secondary" },
  UNDER_REVIEW: { label: "Under Review", variant: "default" },
  PLANNED:      { label: "Planned",      variant: "default" },
  IN_PROGRESS:  { label: "In Progress",  variant: "default" },
  LAUNCHED:     { label: "Launched",     variant: "default" },
  DECLINED:     { label: "Declined",     variant: "destructive" },
}

const STATUS_OPTIONS: FeedbackStatus[] = [
  "NEW",
  "UNDER_REVIEW",
  "PLANNED",
  "IN_PROGRESS",
  "LAUNCHED",
  "DECLINED",
]

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FEATURE_REQUEST: "Feature Request",
  BUG_REPORT:      "Bug Report",
  INTEGRATION:     "Integration",
  NEW_AGENT:       "New Agent",
  UX_IMPROVEMENT:  "UX",
  GENERAL:         "General",
}

// ─── Expanded row panel ───────────────────────────────────────────────────────

interface AdminReplyPanelProps {
  post: FeedbackPost
  onClose: () => void
}

function AdminReplyPanel({ post, onClose }: AdminReplyPanelProps) {
  const [adminReply, setAdminReply] = useState(post.adminReply ?? "")
  const [roadmapEta, setRoadmapEta] = useState(post.roadmapEta ?? "")
  const [adminNote, setAdminNote] = useState("")

  const updateStatus = useUpdateFeedbackStatus()

  const handleSave = async () => {
    try {
      await updateStatus.mutateAsync({
        id: post.id,
        status: post.status,
        adminReply: adminReply || null,
        roadmapEta: roadmapEta || null,
        adminNote: adminNote || null,
      })
      toast.success("Reply saved")
      onClose()
    } catch {
      toast.error("Failed to save reply")
    }
  }

  return (
    <div className="border-t border-border bg-muted/40 p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">Public admin reply</Label>
        <Textarea
          value={adminReply}
          onChange={(e) => setAdminReply(e.target.value)}
          placeholder="Visible to all users who submitted or voted on this post…"
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">Roadmap ETA</Label>
        <Input
          value={roadmapEta}
          onChange={(e) => setRoadmapEta(e.target.value)}
          placeholder="e.g. Q3 2025, October, Next sprint…"
          className="text-sm max-w-xs"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">Internal note (private)</Label>
        <Textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Internal notes — not visible to users…"
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateStatus.isPending}
        >
          {updateStatus.isPending ? "Saving…" : "Save reply"}
        </Button>
      </div>
    </div>
  )
}

// ─── Feedback table row ───────────────────────────────────────────────────────

interface FeedbackRowProps {
  post: FeedbackPost
  expanded: boolean
  onToggleExpand: () => void
}

function FeedbackRow({ post, expanded, onToggleExpand }: FeedbackRowProps) {
  const updateStatus = useUpdateFeedbackStatus()

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: post.id, status: newStatus as FeedbackStatus })
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    }
  }

  const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.NEW

  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell className="py-2.5">
          <div className="flex flex-col gap-0.5 max-w-[280px]">
            <span className="text-xs font-medium text-foreground leading-snug line-clamp-2">
              {post.title}
            </span>
            {post.agentSlug && (
              <span className="text-[10px] text-muted-foreground font-mono uppercase">
                {post.agentSlug}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="py-2.5">
          <Badge variant="outline" className="text-[10px] font-mono uppercase">
            {CATEGORY_LABELS[post.category] ?? post.category}
          </Badge>
        </TableCell>
        <TableCell className="py-2.5">
          <Select value={post.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue>
                <Badge variant={cfg.variant} className="text-[10px]">
                  {cfg.label}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-2.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ThumbsUp className="size-3" />
            {post.voteCount}
          </div>
        </TableCell>
        <TableCell className="py-2.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3" />
            {post._count.comments}
          </div>
        </TableCell>
        <TableCell className="py-2.5">
          <span className="text-[10px] text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
        </TableCell>
        <TableCell className="py-2.5">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleExpand}
              title={expanded ? "Collapse" : "Add reply"}
            >
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0">
            <AdminReplyPanel post={post} onClose={onToggleExpand} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Upcoming agent dialog ────────────────────────────────────────────────────

interface AgentDialogProps {
  open: boolean
  onClose: () => void
  editing: UpcomingAgent | null
}

function AgentDialog({ open, onClose, editing }: AgentDialogProps) {
  const [name, setName] = useState(editing?.name ?? "")
  const [tagline, setTagline] = useState(editing?.tagline ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [emoji, setEmoji] = useState(editing?.emoji ?? "")
  const [color, setColor] = useState(editing?.color ?? "")
  const [order, setOrder] = useState(String(editing ? 0 : 0))

  const create = useCreateUpcomingAgent()
  const update = useUpdateUpcomingAgent()

  const isPending = create.isPending || update.isPending

  const handleSubmit = async () => {
    if (!name.trim() || !tagline.trim()) {
      toast.error("Name and tagline are required")
      return
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim() || null,
          emoji: emoji.trim() || null,
          color: color.trim() || null,
          order: order ? Number(order) : undefined,
        })
        toast.success("Agent updated")
      } else {
        await create.mutateAsync({
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim() || undefined,
          emoji: emoji.trim() || undefined,
          color: color.trim() || undefined,
          order: order ? Number(order) : undefined,
        })
        toast.success("Agent created")
      }
      onClose()
    } catch {
      toast.error("Failed to save agent")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit upcoming agent" : "Add upcoming agent"}</DialogTitle>
          <DialogDescription>
            Upcoming agents are shown on the public roadmap for users to vote on.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harvey"
              className="text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Tagline *</Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Your AI legal assistant"
              className="text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional longer description…"
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="⚡"
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#F5C518"
                className="text-sm font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Order</Label>
              <Input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : editing ? "Save changes" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackAdminPage() {
  const { data: feedbackPosts, isLoading: feedbackLoading } = useAdminFeedbackList()
  const { data: upcomingAgents, isLoading: agentsLoading } = useUpcomingAgents()

  const deleteAgent = useDeleteUpcomingAgent()
  const updateAgent = useUpdateUpcomingAgent()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [agentDialog, setAgentDialog] = useState<{ open: boolean; editing: UpcomingAgent | null }>({
    open: false,
    editing: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<UpcomingAgent | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return
    try {
      await deleteAgent.mutateAsync(deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch {
      toast.error("Failed to delete agent")
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleHideAgent = async (agent: UpcomingAgent) => {
    try {
      await updateAgent.mutateAsync({ id: agent.id, isVisible: false })
      toast.success(`"${agent.name}" hidden from public roadmap`)
    } catch {
      toast.error("Failed to update visibility")
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        kicker="settings"
        title="feedback"
        subtitle="Manage user feedback, update statuses, write replies, and curate upcoming agents."
        sticker={{ label: "community", rot: -3, color: "var(--vq-violet)" }}
      />

      <SettingsNav />

      {/* ── Feedback posts ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">All feedback posts</h2>
          <p className="text-xs text-muted-foreground">
            {feedbackLoading
              ? "Loading…"
              : `${feedbackPosts?.length ?? 0} post${feedbackPosts?.length !== 1 ? "s" : ""}, sorted by votes`}
          </p>
        </div>
      </div>

      <Card>
        {feedbackLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Votes</TableHead>
                <TableHead className="w-16">Comments</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right w-12">Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!feedbackPosts || feedbackPosts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-xs text-muted-foreground py-8"
                  >
                    No feedback posts yet.
                  </TableCell>
                </TableRow>
              ) : (
                feedbackPosts.map((post) => (
                  <FeedbackRow
                    key={post.id}
                    post={post}
                    expanded={expandedId === post.id}
                    onToggleExpand={() => toggleExpand(post.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Upcoming agents ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">Upcoming agents</h2>
          <p className="text-xs text-muted-foreground">
            {agentsLoading
              ? "Loading…"
              : `${upcomingAgents?.length ?? 0} agent${upcomingAgents?.length !== 1 ? "s" : ""} on the roadmap`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAgentDialog({ open: true, editing: null })}
        >
          <Plus className="size-3.5" />
          Add agent
        </Button>
      </div>

      <Card>
        {agentsLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Tagline</TableHead>
                <TableHead className="w-20">Votes</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!upcomingAgents || upcomingAgents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground py-8"
                  >
                    No upcoming agents yet. Add one to show on the public roadmap.
                  </TableCell>
                </TableRow>
              ) : (
                upcomingAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {agent.emoji && (
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-border text-sm"
                            style={{ background: agent.color ?? undefined }}
                          >
                            {agent.emoji}
                          </span>
                        )}
                        <span className="text-xs font-medium text-foreground">
                          {agent.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{agent.tagline}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="size-3" />
                        {agent.voteCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleHideAgent(agent)}
                          title="Hide from public roadmap"
                        >
                          <EyeOff className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setAgentDialog({ open: true, editing: agent })}
                          title="Edit agent"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(agent)}
                          title="Delete agent"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <AgentDialog
        open={agentDialog.open}
        onClose={() => setAgentDialog({ open: false, editing: null })}
        editing={agentDialog.editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the upcoming agent and all associated votes. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
