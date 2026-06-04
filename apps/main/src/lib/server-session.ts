import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export interface ConsoleSession {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  activeOrganizationId: string;
}

interface RawSessionResponse {
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  session?: {
    activeOrganizationId?: string | null;
  };
}



// Fetches the Better Auth session over HTTP, forwarding the browser cookies.
// Importing the server's `auth` directly doesn't work here — the server uses
// Node ESM `.js` import extensions that Next's webpack cannot resolve.
async function fetchSession(): Promise<RawSessionResponse | null> {
  const forwarded = await headers();
  const ua = forwarded.get("user-agent") ?? "";
  // Use the raw Cookie header so nothing is lost in parse/re-serialize
  const rawCookieHeader = forwarded.get("cookie") ?? "";

  try {
    const url = `${process.env.BACKEND_URL}/api/v1/auth/get-session`;
    console.log("[session] fetching from:", url);
    console.log("[session] raw cookie header:", rawCookieHeader.slice(0, 300));
    const res = await fetch(url, {
      headers: {
        cookie: rawCookieHeader,
        "user-agent": ua,
      },
      cache: "no-store",
    });
    console.log("[session] response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.log("[session] error body:", text.slice(0, 200));
      return null;
    }
    const body = (await res.json()) as RawSessionResponse | null;
    console.log("[session] has user:", !!body?.user);
    if (!body || !body.user) return null;
    return body;
  } catch (e) {
    console.error("[session] fetch threw:", e);
    return null;
  }
}

export async function requireSession(): Promise<ConsoleSession> {
  const sess = await fetchSession();
  if (!sess?.user) {
    redirect("/login");
  }
  const activeOrganizationId = sess.session?.activeOrganizationId ?? null;
  if (!activeOrganizationId) {
    redirect("/workspaces");
  }
  return {
    userId: sess.user.id,
    userName: sess.user.name,
    userEmail: sess.user.email,
    userImage: sess.user.image ?? null,
    activeOrganizationId,
  };
}

export async function getSession() {
  return fetchSession();
}
