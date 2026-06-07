"use client";
import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

const PAGE_SIZE = 25;

type BaUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  banned?: boolean | null;
  banReason?: string | null;
};

export function UsersClient() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showBanned, setShowBanned] = useState(false);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<BaUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await (authClient as any).admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset,
          ...(search ? { searchValue: search, searchField: "email" } : {}),
          ...(showBanned ? { filterField: "banned", filterValue: "true" } : {}),
        },
      });
      if (result.error) throw new Error(result.error.message ?? "Unknown error");
      setUsers(result.data?.users ?? []);
      setTotal(result.data?.total ?? 0);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, [search, showBanned, offset]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleBan = async (user: BaUser) => {
    setBanningId(user.id);
    try {
      if (user.banned) {
        await (authClient as any).admin.unbanUser({ userId: user.id });
        toast.success(`${user.email} unbanned`);
      } else {
        await (authClient as any).admin.banUser({
          userId: user.id,
          banReason: "Banned by admin",
          banExpiresIn: 365 * 24 * 60 * 60,
        });
        toast.success(`${user.email} banned`);
      }
      await load();
    } catch {
      toast.error("Failed to update ban status");
    } finally {
      setBanningId(null);
    }
  };

  const verifyEmail = async (u: BaUser) => {
    setVerifyingId(u.id);
    try {
      await apiFetch(`/admin/users/${u.id}/verify-email`, { method: "POST" });
      toast.success(`Email verified for ${u.email}`);
      await load();
    } catch {
      toast.error("Failed to verify email");
    } finally {
      setVerifyingId(null);
    }
  };

  const revokeSessions = async (u: BaUser) => {
    if (!window.confirm(`Revoke all sessions for ${u.email}?`)) return;
    setRevokingId(u.id);
    try {
      await apiFetch(`/admin/users/${u.id}/sessions`, { method: "DELETE" });
      toast.success("Sessions revoked");
      await load();
    } catch {
      toast.error("Failed to revoke sessions");
    } finally {
      setRevokingId(null);
    }
  };

  const deleteUser = async (u: BaUser) => {
    if (confirmDeleteId !== u.id) {
      setConfirmDeleteId(u.id);
      return;
    }
    setDeletingId(u.id);
    setConfirmDeleteId(null);
    try {
      await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      toast.success(`${u.email} deleted`);
      await load();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const BASE = `${process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:5000"}/api/${process.env.NEXT_PUBLIC_API_VERSION ?? "v1"}`;
      const res = await fetch(`${BASE}/admin/users/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email…"
            className="w-64 rounded border border-[var(--border)] bg-[var(--card)] py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-1">
          {["All", "Banned"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setShowBanned(tab === "Banned");
                setOffset(0);
              }}
              className={cn(
                "rounded px-3 py-1 text-sm",
                showBanned === (tab === "Banned")
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : fetchError ? (
        <p className="text-sm text-red-500">{fetchError}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                {["Name", "Email", "Verified", "Created", "Status", ""].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    "hover:bg-[var(--muted)]",
                    u.banned && "bg-red-50/50",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">{u.email}</td>
                  <td className="px-4 py-2.5 text-center">{u.emailVerified ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.banned ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleBan(u)}
                        disabled={banningId === u.id}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50",
                          u.banned
                            ? "border border-green-300 text-green-700 hover:bg-green-50"
                            : "border border-red-300 text-red-700 hover:bg-red-50",
                        )}
                      >
                        {banningId === u.id ? "…" : u.banned ? "Unban" : "Ban"}
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(null); void verifyEmail(u); }}
                        disabled={verifyingId === u.id || u.emailVerified === true}
                        className="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 border border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        {verifyingId === u.id ? "…" : "Verify Email"}
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(null); void revokeSessions(u); }}
                        disabled={revokingId === u.id}
                        className="rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50 border border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        {revokingId === u.id ? "…" : "Revoke Sessions"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={deletingId === u.id}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50",
                          confirmDeleteId === u.id
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "border border-red-300 text-red-700 hover:bg-red-50",
                        )}
                      >
                        {deletingId === u.id ? "…" : confirmDeleteId === u.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No users found.
            </p>
          )}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted-foreground)]">{total} users</p>
          <div className="flex items-center gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded border border-[var(--border)] bg-[var(--card)] p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded border border-[var(--border)] bg-[var(--card)] p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
