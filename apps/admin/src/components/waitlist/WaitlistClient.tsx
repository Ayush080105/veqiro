"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCcw,
  Search,
  TicketPercent,
  UserRoundPlus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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

type WaitlistEntry = {
  id: string;
  email: string;
  coupon: string | null;
  validTill: string | null;
  createdAt: string;
};

type WaitlistResponse = {
  entries: WaitlistEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  pageSize: number;
};

export function WaitlistClient() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const page = cursorStack.length + 1;

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    if (search) params.set("search", search);
    return params.toString();
  }, [cursor, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WaitlistResponse>(`/admin/waitlist?${query}`);
      setEntries(data.entries);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load waitlist");
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
            <UserRoundPlus className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Waitlist</h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Review people waiting for Veqiro access.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search email..."
              className="h-9 w-full rounded border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] sm:w-72"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            <span className="sr-only">Refresh waitlist</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total entries</p>
          <p className="mt-2 text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Page size</p>
          <p className="mt-2 text-2xl font-semibold">{PAGE_SIZE}</p>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Current page</p>
          <p className="mt-2 text-2xl font-semibold">{page}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--muted)] hover:bg-[var(--muted)]">
              <TableHead>Email</TableHead>
              <TableHead>Coupon</TableHead>
              <TableHead>Valid till</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <div className="h-5 w-full animate-pulse rounded bg-black/10" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-red-600">
                  {error}
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  No waitlist entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
                      {entry.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.coupon ? (
                      <Badge variant="success" className="gap-1">
                        <TicketPercent className="h-3 w-3" />
                        {entry.coupon}
                      </Badge>
                    ) : (
                      <Badge variant="outline">None</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {entry.validTill ? (
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {format(new Date(entry.validTill), "MMM d, yyyy")}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-[var(--muted-foreground)]">
                    {format(new Date(entry.createdAt), "MMM d, yyyy, h:mm a")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
