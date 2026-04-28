export type SubscriptionView = {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  plan: "MONTHLY" | "ANNUAL" | null;
  dodoCustomerId: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  isEntitled: boolean;
};

export type SessionPayload = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
  subscription?: SubscriptionView | null;
};

export type RouteContext = {
  pathname: string;
};

/**
 * Pure routing decision for the proxy middleware. Returns the path to
 * redirect to, or null to allow the request through.
 *
 * This function preserves the legacy three-state behavior (no
 * activeOrg → /onboarding for protected paths). The four-state version
 * with /workspaces lands in Task 7.
 */
export function routeForUser(
  payload: SessionPayload | null,
  ctx: RouteContext,
): string | null {
  const { pathname } = ctx;
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnOnboarding = pathname.startsWith("/onboarding");
  // Every page inside the (dashboard) route group is protected, not just
  // /dashboard itself. Keep this list in sync with the proxy matcher.
  const isOnProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/assistants") ||
    pathname.startsWith("/brain") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/workspace");

  // Unauthenticated branch
  if (!payload?.user) {
    if (isOnLogin) return null;
    if (isOnOnboarding || isOnProtected || isOnRoot) return "/login";
    return null;
  }

  const onboarded = !!payload.activeOrganization?.onboarded;

  if (isOnLogin || isOnRoot) {
    return onboarded ? "/dashboard" : "/onboarding";
  }

  if (onboarded && isOnOnboarding) {
    return "/dashboard";
  }

  if (!onboarded && isOnProtected) {
    return "/onboarding";
  }

  return null;
}
