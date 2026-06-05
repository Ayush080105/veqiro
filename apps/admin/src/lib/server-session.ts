import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface AdminSession {
  userId: string;
  userName: string;
  userEmail: string;
}

interface RawSession {
  user?: { id: string; name: string; email: string; role?: string | null };
}

async function fetchSession(): Promise<RawSession | null> {
  const hdrs = await headers();
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/api/v1/auth/get-session`,
      {
        headers: {
          cookie: hdrs.get("cookie") ?? "",
          "user-agent": hdrs.get("user-agent") ?? "",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as RawSession | null;
    return body?.user ? body : null;
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const sess = await fetchSession();
  if (!sess?.user) redirect("/login");
  if (sess.user.role !== "admin") redirect("/login?error=forbidden");
  return {
    userId: sess.user.id,
    userName: sess.user.name,
    userEmail: sess.user.email,
  };
}
