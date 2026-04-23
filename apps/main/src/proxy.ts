import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL!;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";

type SessionResponse = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
};

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

  const loginUrl = new URL("/login", request.url);
  const onboardingUrl = new URL("/onboarding", request.url);
  const dashboardUrl = new URL("/dashboard", request.url);

  if (!payload?.user) {
    return pathname === "/login"
      ? NextResponse.next()
      : NextResponse.redirect(loginUrl);
  }

  const onboarded = !!payload.activeOrganization?.onboarded;
  const target = onboarded ? dashboardUrl : onboardingUrl;

  if (pathname === "/login") return NextResponse.redirect(target);

  // pathname === "/"
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/", "/login"],
};
