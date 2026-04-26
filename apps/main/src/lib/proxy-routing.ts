export type SessionPayload = {
  user?: { id: string } | null;
  activeOrganization?: { id: string; onboarded: boolean } | null;
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
  const isOnDashboard = pathname.startsWith("/dashboard");

  // Unauthenticated branch
  if (!payload?.user) {
    if (isOnLogin) return null;
    if (isOnOnboarding || isOnDashboard || isOnRoot) return "/login";
    return null;
  }

  const onboarded = !!payload.activeOrganization?.onboarded;

  if (isOnLogin || isOnRoot) {
    return onboarded ? "/dashboard" : "/onboarding";
  }

  if (onboarded && isOnOnboarding) {
    return "/dashboard";
  }

  if (!onboarded && isOnDashboard) {
    return "/onboarding";
  }

  return null;
}
