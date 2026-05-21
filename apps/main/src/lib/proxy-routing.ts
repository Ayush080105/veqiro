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
  memberships?: Array<{ id: string }> | null;
  subscription?: SubscriptionView | null;
};

export type RouteContext = {
  pathname: string;
};

/**
 * Pure routing decision for the proxy middleware. Returns the path to
 * redirect to, or null to allow the request through.
 */
export function routeForUser(
  payload: SessionPayload | null,
  ctx: RouteContext,
): string | null {
  const { pathname } = ctx;
  const isOnLogin = pathname === "/login";
  const isOnRoot = pathname === "/";
  const isOnOnboarding = pathname.startsWith("/onboarding");
  const isOnWorkspaces = pathname === "/workspaces";
  const isOnProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/assistants") ||
    pathname.startsWith("/brain") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/workspace");

  if (!payload?.user) {
    if (isOnLogin) return null;
    if (isOnOnboarding || isOnProtected || isOnRoot || isOnWorkspaces) {
      return "/login";
    }
    return null;
  }

  const hasActive = !!payload.activeOrganization;
  const onboarded = !!payload.activeOrganization?.onboarded;
  const hasMemberships = (payload.memberships?.length ?? 0) > 0;

  if (isOnLogin || isOnRoot) {
    if (hasActive && onboarded) return "/dashboard";
    if (hasActive && !onboarded) return "/onboarding";
    if (!hasActive && hasMemberships) return "/workspaces";
    return "/onboarding";
  }

  if (isOnWorkspaces) {
    if (!hasMemberships) return "/onboarding";
    return null;
  }

  if (isOnOnboarding) {
    if (hasActive && onboarded) return "/dashboard";
    return null;
  }

  if (isOnProtected) {
    if (!hasActive && hasMemberships) return "/workspaces";
    if (!hasActive && !hasMemberships) return "/onboarding";
    if (!onboarded) return "/onboarding";
  }

  return null;
}
