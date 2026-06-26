"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;
const API_BASE = `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}`;

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedbackStatus =
  | "NEW"
  | "UNDER_REVIEW"
  | "PLANNED"
  | "IN_PROGRESS"
  | "LAUNCHED"
  | "DECLINED";

type FeedbackCategory =
  | "FEATURE_REQUEST"
  | "BUG_REPORT"
  | "INTEGRATION"
  | "NEW_AGENT"
  | "UX_IMPROVEMENT"
  | "GENERAL";

type FeedbackComment = {
  id: string;
  content: string;
  isAdminReply: boolean;
  createdAt: string;
  author: { id: string; name: string; email: string };
};

type FeedbackPost = {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  agentSlug: string | null;
  status: FeedbackStatus;
  voteCount: number;
  adminReply: string | null;
  adminNote: string | null;
  roadmapEta: string | null;
  isMerged: boolean;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  _count: { comments: number };
};

type FeedbackListResponse = {
  data: FeedbackPost[];
  total: number;
  page: number;
  totalPages: number;
};

type FeedbackStats = {
  total: number;
  newThisWeek: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  topVoted: { id: string; title: string; voteCount: number }[];
};

type UpcomingAgent = {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  order: number;
  isVisible: boolean;
  voteCount: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: FeedbackStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "LAUNCHED", label: "Launched" },
  { value: "DECLINED", label: "Declined" },
];

const STATUS_COLORS: Record<FeedbackStatus, { bg: string; color: string }> = {
  NEW: { bg: "#f0f0f0", color: "#666" },
  UNDER_REVIEW: { bg: "#F5C518", color: "#111" },
  PLANNED: { bg: "#8A8AF0", color: "#fff" },
  IN_PROGRESS: { bg: "#6FCDE8", color: "#111" },
  LAUNCHED: { bg: "#1DBC87", color: "#fff" },
  DECLINED: { bg: "#F06464", color: "#fff" },
};

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  FEATURE_REQUEST: "Feature",
  BUG_REPORT: "Bug",
  INTEGRATION: "Integration",
  NEW_AGENT: "New Agent",
  UX_IMPROVEMENT: "UX",
  GENERAL: "General",
};

const CATEGORY_OPTIONS: { value: FeedbackCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Categories" },
  { value: "FEATURE_REQUEST", label: "Feature Request" },
  { value: "BUG_REPORT", label: "Bug Report" },
  { value: "INTEGRATION", label: "Integration" },
  { value: "NEW_AGENT", label: "New Agent" },
  { value: "UX_IMPROVEMENT", label: "UX Improvement" },
  { value: "GENERAL", label: "General / Opinion" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

async function safeDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
}

// ── Admin Reply Panel ─────────────────────────────────────────────────────────

function AdminReplyPanel({
  post,
  onSaved,
  onCancel,
}: {
  post: FeedbackPost;
  onSaved: (updated: Partial<FeedbackPost>) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(post.status);
  const [adminReply, setAdminReply] = useState(post.adminReply ?? "");
  const [adminNote, setAdminNote] = useState(post.adminNote ?? "");
  const [roadmapEta, setRoadmapEta] = useState(post.roadmapEta ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/admin/feedback/${post.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          adminReply: adminReply || null,
          adminNote: adminNote || null,
          roadmapEta: roadmapEta || null,
        }),
      });
      onSaved({ status, adminReply: adminReply || null, adminNote: adminNote || null, roadmapEta: roadmapEta || null });
      toast.success("Feedback updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--border)] bg-[var(--muted)]/40 px-4 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
            className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.filter((s) => s.value !== "ALL").map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Roadmap ETA</label>
          <input
            type="text"
            value={roadmapEta}
            onChange={(e) => setRoadmapEta(e.target.value)}
            placeholder="e.g. Q3 2026, October..."
            className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm placeholder:text-[var(--muted-foreground)]"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">
          Public Reply{" "}
          <span className="font-normal opacity-60">(visible to all voters)</span>
        </label>
        <textarea
          value={adminReply}
          onChange={(e) => setAdminReply(e.target.value)}
          rows={3}
          placeholder="Write a public reply visible to all voters..."
          className="resize-none rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--muted-foreground)]">
          Internal Note{" "}
          <span className="font-normal opacity-60">(not visible to users)</span>
        </label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          placeholder="Internal note — not visible to users"
          className="resize-none rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save"}
        </Button>
        <button
          onClick={onCancel}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Comments Panel ────────────────────────────────────────────────────────────

function CommentsPanel({ postId, commentCount }: { postId: string; commentCount: number }) {
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (commentCount === 0) return;
    setLoading(true);
    apiFetch<FeedbackComment[]>(`/admin/feedback/${postId}/comments`)
      .then((data) => { setComments(data); setLoaded(true); })
      .catch(() => setLoaded(true))
      .finally(() => setLoading(false));
  }, [postId, commentCount]);

  if (commentCount === 0) return null;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
        Comments ({commentCount})
      </p>
      {loading && (
        <p className="text-xs text-[var(--muted-foreground)]">Loading comments...</p>
      )}
      {loaded && comments.length === 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">No comments yet.</p>
      )}
      <div className="flex flex-col gap-2">
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-md border px-3 py-2 text-sm ${
              c.isAdminReply
                ? "border-[var(--primary)]/30 bg-[var(--primary)]/5"
                : "border-[var(--border)] bg-[var(--card)]"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">{c.author.name}</span>
              {c.isAdminReply && (
                <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--primary-foreground)]">
                  Admin
                </span>
              )}
              <span>{timeAgo(c.createdAt)}</span>
            </div>
            <p className="leading-snug text-[var(--foreground)]">{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agent Dialog ──────────────────────────────────────────────────────────────

function AgentDialog({
  initial,
  onSave,
  onClose,
}: {
  initial?: UpcomingAgent | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4ECDC4");
  const [order, setOrder] = useState(String(initial?.order ?? 0));
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !tagline.trim()) {
      toast.error("Name and tagline are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        tagline,
        description: description || null,
        emoji: emoji || null,
        color: color || null,
        order: Number(order) || 0,
        isVisible,
      };
      if (initial) {
        await apiFetch(`/admin/feedback/upcoming-agents/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/admin/feedback/upcoming-agents", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success(initial ? "Agent updated" : "Agent created");
      onSave();
    } catch {
      toast.error("Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <h3 className="mb-4 text-base font-semibold">
          {initial ? "Edit Agent" : "Add Upcoming Agent"}
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex w-20 flex-col gap-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">Emoji</label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🤖"
                maxLength={4}
                className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-center text-lg"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agent name"
                className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--muted-foreground)]">Tagline *</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short one-line description"
              className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--muted-foreground)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Longer description shown in the card"
              className="resize-none rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-[var(--border)]"
                />
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#4ECDC4"
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex w-20 flex-col gap-1.5">
              <label className="text-xs text-[var(--muted-foreground)]">Order</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="rounded"
            />
            Visible to users
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => void submit()} disabled={saving} size="sm">
            {saving ? "Saving..." : initial ? "Update" : "Create"}
          </Button>
          <button
            onClick={onClose}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FeedbackClient() {
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [agents, setAgents] = useState<UpcomingAgent[]>([]);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<UpcomingAgent | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 300);
  };

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (search) params.set("search", search);
      const data = await apiFetch<FeedbackListResponse>(`/admin/feedback?${params}`);
      setPosts(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setError("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, search]);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<FeedbackStats>("/admin/feedback/stats");
      setStats(data);
    } catch {
      // non-critical
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const data = await apiFetch<UpcomingAgent[]>("/admin/feedback/upcoming-agents");
      setAgents(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { void loadFeedback(); }, [loadFeedback]);
  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const applyPostUpdate = (id: string, patch: Partial<FeedbackPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setExpandedId(null);
    void loadStats();
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Delete this upcoming agent?")) return;
    try {
      await safeDelete(`/admin/feedback/upcoming-agents/${id}`);
      toast.success("Agent deleted");
      void loadAgents();
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  const toggleAgentVisibility = async (agent: UpcomingAgent) => {
    try {
      await apiFetch(`/admin/feedback/upcoming-agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible: !agent.isVisible }),
      });
      void loadAgents();
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const exportCsv = () => {
    const header = "id,title,category,agent,status,votes,submitter,email,created\n";
    const rows = posts.map((p) =>
      [
        p.id,
        `"${p.title.replace(/"/g, '""')}"`,
        p.category,
        p.agentSlug ?? "",
        p.status,
        p.voteCount,
        `"${p.createdBy.name.replace(/"/g, '""')}"`,
        p.createdBy.email,
        new Date(p.createdAt).toISOString(),
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCount = stats
    ? (stats.byStatus["NEW"] ?? 0) +
      (stats.byStatus["UNDER_REVIEW"] ?? 0) +
      (stats.byStatus["PLANNED"] ?? 0) +
      (stats.byStatus["IN_PROGRESS"] ?? 0)
    : null;

  const resolvedCount = stats
    ? (stats.byStatus["LAUNCHED"] ?? 0) + (stats.byStatus["DECLINED"] ?? 0)
    : null;

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Feedback</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Manage user feedback, feature requests, and upcoming agents.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Submissions", value: stats?.total ?? "—" },
          { label: "New This Week", value: stats?.newThisWeek ?? "—" },
          { label: "Open", value: openCount ?? "—" },
          { label: "Resolved", value: resolvedCount ?? "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value as FeedbackStatus | "ALL");
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              statusFilter === opt.value
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Category filter + search + export */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as FeedbackCategory | "ALL");
            setPage(1);
          }}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--foreground)]"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search feedback..."
            className="w-full rounded border border-[var(--border)] bg-[var(--card)] py-1.5 pl-8 pr-3 text-sm placeholder:text-[var(--muted-foreground)]"
          />
        </div>

        <button
          onClick={exportCsv}
          className="ml-auto flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Feedback table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Votes</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                  Loading...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-red-500">
                  {error}
                </TableCell>
              </TableRow>
            ) : posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                  No feedback found.
                </TableCell>
              </TableRow>
            ) : (
              posts.flatMap((post) => {
                const isExpanded = expandedId === post.id;
                const sc = STATUS_COLORS[post.status];
                return [
                  <TableRow
                    key={post.id}
                    className="cursor-pointer hover:bg-[var(--muted)]"
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                  >
                    <TableCell>
                      <div className="line-clamp-1 text-sm font-medium">{post.title}</div>
                      <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        {post.createdBy.name} · {post.createdBy.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--muted-foreground)]">
                      {CATEGORY_LABELS[post.category]}
                    </TableCell>
                    <TableCell>
                      {post.agentSlug ? (
                        <span className="font-mono text-xs">{post.agentSlug}</span>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        {post.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {post.voteCount}
                    </TableCell>
                    <TableCell className="text-xs text-[var(--muted-foreground)]">
                      {timeAgo(post.createdAt)}
                    </TableCell>
                    <TableCell>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </TableCell>
                  </TableRow>,
                  ...(isExpanded
                    ? [
                        <TableRow key={`${post.id}-reply`}>
                          <TableCell colSpan={7} className="p-0">
                            {post.description && (
                              <div className="border-t border-[var(--border)] bg-[var(--muted)]/20 px-4 py-3">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                                  Description
                                </p>
                                <p className="text-sm leading-relaxed text-[var(--foreground)]">
                                  {post.description}
                                </p>
                              </div>
                            )}
                            <CommentsPanel postId={post.id} commentCount={post._count.comments} />
                            <AdminReplyPanel
                              post={post}
                              onSaved={(patch) => applyPostUpdate(post.id, patch)}
                              onCancel={() => setExpandedId(null)}
                            />
                          </TableCell>
                        </TableRow>,
                      ]
                    : []),
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming Agents section */}
      <div className="border-t border-[var(--border)] pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Upcoming Agents</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Shown on the feedback page for users to vote on.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingAgent(null);
              setAgentDialogOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Agent
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="w-[42%]">Tagline</TableHead>
                <TableHead className="text-right">Votes</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                    No upcoming agents yet.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agent.emoji && <span className="text-lg">{agent.emoji}</span>}
                        <div>
                          <div className="font-medium text-sm">{agent.name}</div>
                          {agent.color && (
                            <div
                              className="mt-0.5 h-1.5 w-8 rounded-full"
                              style={{ background: agent.color }}
                            />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted-foreground)]">
                      {agent.tagline}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {agent.voteCount}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => void toggleAgentVisibility(agent)}
                        title={agent.isVisible ? "Hide from users" : "Show to users"}
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {agent.isVisible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingAgent(agent);
                            setAgentDialogOpen(true);
                          }}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void deleteAgent(agent.id)}
                          className="text-[var(--muted-foreground)] hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Agent dialog */}
      {agentDialogOpen && (
        <AgentDialog
          initial={editingAgent}
          onSave={() => {
            setAgentDialogOpen(false);
            void loadAgents();
          }}
          onClose={() => setAgentDialogOpen(false)}
        />
      )}
    </div>
  );
}
