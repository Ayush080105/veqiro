import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { routeForUser, type SessionPayload } from "@/lib/proxy-routing";

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.API_VERSION || process.env.NEXT_PUBLIC_API_VERSION || "v1";
const SESSION_CACHE_TTL_MS = 8_000;
const SESSION_CACHE_MAX = 250;

type SessionCacheEntry = {
  payload: SessionPayload | null;
  expiresAt: number;
};

const sessionCache = new Map<string, SessionCacheEntry>();

function getSessionCacheKey(cookie: string): string | null {
  const tokenMatch = cookie.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session(?:-|_)token=([^;]+)/u,
  );
  return tokenMatch?.[1] ?? null;
}

function pruneSessionCache(now: number) {
  if (sessionCache.size <= SESSION_CACHE_MAX) return;
  for (const [key, entry] of sessionCache) {
    if (entry.expiresAt <= now || sessionCache.size > SESSION_CACHE_MAX) {
      sessionCache.delete(key);
    }
  }
}

async function getSessionPayload(
  cookie: string,
  forceRefresh: boolean,
): Promise<SessionPayload | null> {
  const now = Date.now();
  const cacheKey = getSessionCacheKey(cookie);

  if (cacheKey && !forceRefresh) {
    const cached = sessionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.payload;
    }
  }

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

  if (cacheKey) {
    sessionCache.set(cacheKey, {
      payload,
      expiresAt: now + SESSION_CACHE_TTL_MS,
    });
    pruneSessionCache(now);
  }

  return payload;
}

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
  const forceRefresh =
    request.nextUrl.searchParams.get("__session") === "refresh";
  const payload = await getSessionPayload(cookie, forceRefresh);

  const destination = routeForUser(payload, { pathname: request.nextUrl.pathname });
  if (destination) {
    return NextResponse.redirect(new URL(destination, request.url));
  }
  if (forceRefresh) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("__session");
    return NextResponse.redirect(cleanUrl);
  }
  return NextResponse.next();
}

// Matcher uses the object form with `missing` header constraints so that
// prefetch and RSC navigation requests skip the proxy entirely. This is the
// recommended pattern from the Next.js docs since these headers are stripped
// from `request.headers` inside the proxy function and can only be filtered
// here at the routing layer.
// NOTE: `missing` must be inlined — Next.js static analysis can't resolve
// variable references inside the config export.
export const config = {
  matcher: [
    { source: "/", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/login", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/workspaces", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/onboarding", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/onboarding/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/dashboard", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/dashboard/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/assistants", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/assistants/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/brain", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/brain/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/settings", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/settings/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/workspace", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
    { source: "/workspace/:path*", missing: [{ type: "header", key: "rsc" }, { type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
  ],
};
