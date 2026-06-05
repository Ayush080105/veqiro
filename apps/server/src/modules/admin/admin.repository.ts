import { prisma } from "../../config/prisma.js";
import { buildSignupBuckets, buildHealthBuckets } from "./admin.charts.js";

const PAGE_SIZE = 25;
const ALL_AGENTS = ["MAYA", "REX", "SCOUT", "SAGE", "LEX", "VEGA"] as const;

export async function getOverviewStats() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const [
    totalOrgs,
    activeCount,
    trialingCount,
    pastDueCount,
    cancelledExpiredCount,
    newOrgsThisWeek,
    totalUsers,
    trialExpiringSoon,
    orgsForCharts,
    agentCounts,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { subscriptionStatus: "ACTIVE" } }),
    prisma.organization.count({ where: { subscriptionStatus: "TRIALING" } }),
    prisma.organization.count({ where: { subscriptionStatus: "PAST_DUE" } }),
    prisma.organization.count({
      where: { subscriptionStatus: { in: ["CANCELLED", "EXPIRED"] } },
    }),
    prisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count(),
    prisma.organization.count({
      where: {
        subscriptionStatus: "TRIALING",
        entitlementExpiresAt: { gte: now, lte: sevenDaysFromNow },
      },
    }),
    prisma.organization.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true, subscriptionStatus: true },
    }),
    prisma.message.groupBy({
      by: ["agent"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  return {
    stats: {
      totalOrgs,
      activeSubscriptions: activeCount,
      trialing: trialingCount,
      trialExpiringSoon,
      pastDue: pastDueCount,
      cancelledOrExpired: cancelledExpiredCount,
      newOrgsThisWeek,
      totalUsers,
    },
    charts: {
      signupsPerWeek: buildSignupBuckets(orgsForCharts, 12, now),
      healthPerWeek: buildHealthBuckets(orgsForCharts, 12, now),
      agentPopularity: agentCounts.map((r) => ({
        agent: r.agent.charAt(0) + r.agent.slice(1).toLowerCase(),
        messages: r._count._all,
      })),
    },
  };
}

export async function listOrganizations(params: {
  search?: string;
  status?: string;
  page: number;
}) {
  const { search, status, page } = params;
  const where = {
    ...(status ? { subscriptionStatus: status as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            {
              members: {
                some: {
                  role: "owner",
                  user: {
                    email: { contains: search, mode: "insensitive" as const },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        onboarded: true,
        createdAt: true,
        subscriptionStatus: true,
        subscription: { select: { plan: true } },
        members: {
          select: {
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    orgs: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      onboarded: o.onboarded,
      createdAt: o.createdAt,
      subscriptionStatus: o.subscriptionStatus,
      plan: o.subscription?.plan ?? null,
      memberCount: o.members.length,
      ownerEmail:
        o.members.find((m) => m.role === "owner")?.user.email ?? null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getOrganizationById(id: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [org, agentCounts, socialAccounts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        onboarded: true,
        createdAt: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            dodoCustomerId: true,
            dodoSubscriptionId: true,
          },
        },
        members: {
          select: {
            role: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.message.groupBy({
      by: ["agent"],
      where: { organizationId: id, createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.socialAccount.findMany({
      where: { organizationId: id },
      select: { platform: true, accountName: true },
    }),
  ]);

  const agentMap: Record<string, number> = {};
  for (const r of agentCounts) agentMap[r.agent] = r._count._all;

  return {
    ...org,
    agentActivity: ALL_AGENTS.map((a) => ({
      agent: a,
      messages: agentMap[a] ?? 0,
    })),
    connectedPlatforms: socialAccounts.map((s) => s.platform),
  };
}

export async function extendTrial(id: string) {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return prisma.organization.update({
    where: { id },
    data: {
      subscriptionStatus: "TRIALING",
      entitlementExpiresAt: sevenDaysFromNow,
    },
    select: { id: true, subscriptionStatus: true, entitlementExpiresAt: true },
  });
}
