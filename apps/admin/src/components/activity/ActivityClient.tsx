"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  History,
  LogIn,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

type ActivityAction =
  | "LOGIN"
  | "PUBLISHED_POST"
  | "GENERATED_VIDEO"
  | "GENERATED_STORYBOARD"
  | "CREDITS_USED";

type ActivityEntry = {
  id: string;
  action: ActivityAction;
  summary: string;
  metadata: Record<string, unknown> | null;
  organizationId: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
};

type ActivityResponse = {
  entries: ActivityEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  pageSize: number;
};

const ACTION_META: Record<ActivityAction, { label: string; Icon: typeof LogIn; color: string }> = {
  LOGIN: { label: "Login", Icon: LogIn, color: "#6B7280" },
  PUBLISHED_POST: { label: "Published post", Icon: Send, color: "#2563EB" },
  GENERATED_VIDEO: { label: "Generated video", Icon: Video, color: "#DB2777" },
  GENERATED_STORYBOARD: { label: "Generated storyboard", Icon: Wand2, color: "#7C3AED" },
  CREDITS_USED: { label: "Used credits", Icon: Sparkles, color: "#D97706" },
};

const ACTION_FILTERS: { value: ActivityAction | ""; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "LOGIN", label: "Login" },
  { value: "PUBLISHED_POST", label: "Published post" },
  { value: "GENERATED_VIDEO", label: "Generated video" },
  { value: "GENERATED_STORYBOARD", label: "Generated storyboard" },
  { value: "CREDITS_USED", label: "Used credits" },
];

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return format(new Date(ts), "MMM d, yyyy, h:mm a");
}

export function ActivityClient() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActivityAction | "">("");

  const page = cursorStack.length + 1;

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    return params.toString();
  }, [cursor, search, action]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ActivityResponse>(`/admin/activity?${query}`);
      setEntries(data.entries);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(null);
      setCursorStack([]);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  const goNext = () => {
    if (!nextCursor) return;
    setCursorStack((current) => [...current, cursor]);
    setCursor(nextCursor);
  };

  const goPrevious = () => {
    setCursorStack((current) => {
      if (current.length === 0) return current;
      const previous = current.at(-1) ?? null;
      setCursor(previous);
      return current.slice(0, -1);
    });
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min((page - 1) * PAGE_SIZE + entries.length, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Activity</h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            See who did what, most recent first.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search user name or email..."
              className="h-9 w-full rounded border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] sm:w-72"
            />
          </div>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as ActivityAction | "");
              setCursor(null);
              setCursorStack([]);
            }}
            className="h-9 rounded border border-[var(--border)] bg-[var(--card)] px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            <span className="sr-only">Refresh activity</span>
          </Button>
        </div>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 sm:w-56">
        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total events</p>
        <p className="mt-2 text-2xl font-semibold">{total}</p>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--muted)]" />
          ))
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            No activity found.
          </p>
        ) : (
          entries.map((entry) => {
            const meta = ACTION_META[entry.action];
            const Icon = meta.Icon;
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: meta.color }}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.user.name}{" "}
                    <span className="font-normal text-[var(--muted-foreground)]">
                      &middot; {entry.user.email}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{entry.summary}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline">{meta.label}</Badge>
                  <span className="text-xs text-[var(--muted-foreground)]">{timeAgo(entry.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Showing {showingFrom}-{showingTo} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrevious}
            disabled={loading || cursorStack.length === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={loading || !hasMore || !nextCursor}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
