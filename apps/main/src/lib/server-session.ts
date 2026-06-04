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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const forwarded = await headers();
  const ua = forwarded.get("user-agent") ?? "";

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/v1/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
        "user-agent": ua,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as RawSessionResponse | null;
    
    if (!body || !body.user) return null;
    return body;
  } catch {
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
