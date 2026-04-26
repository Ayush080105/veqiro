import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { routeForUser, type SessionPayload } from "@/lib/proxy-routing";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";

// Single source of truth for "where should this user be?". The client guards
// (OnboardingGuard, onboarding layout effects) used to race each other and
// produce an infinite /onboarding ↔ /dashboard bounce when react-query cached
// a stale onboarded=false right after finalize. By making this middleware
// authoritative — and trusting the session payload, which `customSession`
// always returns fresh — we kill the race at the source.
export async function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie") ?? "";

  let payload: SessionPayload | null = null;
  try {
    const res = await fetch(
      `${BETTER_AUTH_URL}/api/${API_VERSION}/auth/get-session`,
      { headers: { cookie }, cache: "no-store" },
    );
    if (res.ok) payload = (await res.json()) as SessionPayload;
  } catch {
    // Treat network failure as unauthenticated.
  }

  const destination = routeForUser(payload, { pathname: request.nextUrl.pathname });
  if (destination) {
    return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Cover root, login, and the protected app surfaces. Excluding API routes
  // and Next internals is implicit because we list explicit paths.
  matcher: [
    "/",
    "/login",
    "/onboarding",
    "/onboarding/:path*",
    "/dashboard",
    "/dashboard/:path*",
  ],
};
