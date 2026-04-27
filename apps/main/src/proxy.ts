import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { routeForUser, type SessionPayload } from "@/lib/proxy-routing";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";

// Single source of truth for "where should this user be?". The client guards
// (OnboardingGuard, onboarding layout effects) used to race each other and
// produce an infinite /onboarding ↔ /dashboard bounce when react-query cached
// a stale onboarded=false right after finalize. By making this proxy
// authoritative — and trusting the session payload, which `customSession`
// always returns fresh — we kill the race at the source.
//
// Performance note: the matcher below excludes prefetch + RSC requests so the
// session fetch only runs on hard navigations (initial load, refresh, direct
// URL entry). Client-side nav triggers RSC requests which Next.js doesn't
// expose the `rsc` / `next-router-prefetch` / `purpose: prefetch` headers
// through `request.headers` inside the proxy function — they have to be
// filtered at the matcher layer (see config below).
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

// Matcher uses the object form with `missing` header constraints so that
// prefetch and RSC navigation requests skip the proxy entirely. This is the
// recommended pattern from the Next.js docs since these headers are stripped
// from `request.headers` inside the proxy function and can only be filtered
// here at the routing layer.
const SKIP_FOR_NAVIGATION = [
  { type: "header" as const, key: "rsc" },
  { type: "header" as const, key: "next-router-prefetch" },
  { type: "header" as const, key: "purpose", value: "prefetch" },
];

export const config = {
  matcher: [
    { source: "/", missing: SKIP_FOR_NAVIGATION },
    { source: "/login", missing: SKIP_FOR_NAVIGATION },
    { source: "/onboarding", missing: SKIP_FOR_NAVIGATION },
    { source: "/onboarding/:path*", missing: SKIP_FOR_NAVIGATION },
    { source: "/dashboard", missing: SKIP_FOR_NAVIGATION },
    { source: "/dashboard/:path*", missing: SKIP_FOR_NAVIGATION },
    { source: "/assistants", missing: SKIP_FOR_NAVIGATION },
    { source: "/assistants/:path*", missing: SKIP_FOR_NAVIGATION },
    { source: "/brain", missing: SKIP_FOR_NAVIGATION },
    { source: "/brain/:path*", missing: SKIP_FOR_NAVIGATION },
    { source: "/settings", missing: SKIP_FOR_NAVIGATION },
    { source: "/settings/:path*", missing: SKIP_FOR_NAVIGATION },
    { source: "/workspace", missing: SKIP_FOR_NAVIGATION },
    { source: "/workspace/:path*", missing: SKIP_FOR_NAVIGATION },
  ],
};
