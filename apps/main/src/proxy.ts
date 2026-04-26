import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";

type SessionResponse = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
};

// Single source of truth for "where should this user be?". The client guards
// (OnboardingGuard, onboarding layout effects) used to race each other and
// produce an infinite /onboarding ↔ /dashboard bounce when react-query cached
// a stale onboarded=false right after finalize. By making this middleware
// authoritative — and trusting the session payload, which `customSession`
// always returns fresh — we kill the race at the source.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.headers.get("cookie") ?? "";

  let payload: SessionResponse | null = null;
  try {
    const res = await fetch(
      `${BETTER_AUTH_URL}/api/${API_VERSION}/auth/get-session`,
      { headers: { cookie }, cache: "no-store" },
    );
    if (res.ok) payload = (await res.json()) as SessionResponse;
  } catch {
    // Treat network failure as unauthenticated.
  }

  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnOnboarding = pathname.startsWith("/onboarding");
  const isOnDashboard = pathname.startsWith("/dashboard");

  // Unauthenticated branch ──────────────────────────────────────────────────
  if (!payload?.user) {
    // Login page reachable when signed out; everything else bounces to /login.
    if (isOnLogin) return NextResponse.next();
    if (isOnOnboarding || isOnDashboard || isOnRoot) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const onboarded = !!payload.activeOrganization?.onboarded;

  // Authenticated branch ────────────────────────────────────────────────────
  // Authenticated users on /login or / get routed to the right home.
  if (isOnLogin || isOnRoot) {
    return NextResponse.redirect(
      new URL(onboarded ? "/dashboard" : "/onboarding", request.url),
    );
  }

  // Onboarded user trying to revisit /onboarding/* → push them to dashboard.
  if (onboarded && isOnOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not-yet-onboarded user trying to access /dashboard/* → push to onboarding.
  if (!onboarded && isOnDashboard) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
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
