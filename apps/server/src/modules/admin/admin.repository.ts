import { prisma } from "../../config/prisma.js";
import { buildSignupBuckets, buildHealthBuckets, buildTokenBuckets } from "./admin.charts.js";
import { estimateCost, PLAN_MONTHLY_REVENUE } from "./admin.costs.js";

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
    tokenTotals30d,
    activeOrgsRaw,
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
    prisma.message.aggregate({
      _sum: { tokensUsed: true },
      _count: { _all: true },
      where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.message.groupBy({
      by: ["organizationId"],
      where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const totalTokens30d = tokenTotals30d._sum.tokensUsed ?? 0;

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
      totalTokens30d,
      estimatedCost30d: estimateCost(totalTokens30d, null),
      activeOrgs30d: activeOrgsRaw.length,
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

export async function getUsageStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const [totals30d, totalsAllTime, byAgent, byModel, orgUsageRaw, trendMessages] =
    await Promise.all([
      prisma.message.aggregate({
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.aggregate({
        _sum: { tokensUsed: true },
        where: { role: "assistant" },
      }),
      prisma.message.groupBy({
        by: ["agent"],
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.groupBy({
        by: ["model"],
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.groupBy({
        by: ["organizationId"],
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
        orderBy: { _sum: { tokensUsed: "desc" } },
      }),
      prisma.message.findMany({
        select: { createdAt: true, tokensUsed: true },
        where: { role: "assistant", createdAt: { gte: twelveWeeksAgo } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  // Enrich org usage rows with name + subscription
  const orgIds = orgUsageRaw
    .map((r) => r.organizationId)
    .filter(Boolean) as string[];
  const orgs = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          subscription: { select: { plan: true } },
        },
      })
    : [];
  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  const totalTokens30d = totals30d._sum.tokensUsed ?? 0;
  const totalTokensAllTime = totalsAllTime._sum.tokensUsed ?? 0;
  const totalMessages30d = totals30d._count._all;

  const agentRows = byAgent
    .map((r) => {
      const tokens = r._sum.tokensUsed ?? 0;
      return {
        agent: r.agent.charAt(0) + r.agent.slice(1).toLowerCase(),
        messages: r._count._all,
        tokens,
        estimatedCost: estimateCost(tokens, null),
        pctShare: totalTokens30d > 0 ? Math.round((tokens / totalTokens30d) * 100) : 0,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  const modelRows = byModel
    .map((r) => {
      const tokens = r._sum.tokensUsed ?? 0;
      return {
        model: r.model ?? "unknown",
        messages: r._count._all,
        tokens,
        estimatedCost: estimateCost(tokens, r.model),
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  const enrichedOrgUsage = orgUsageRaw.map((r) => {
    const org = orgMap.get(r.organizationId ?? "");
    const tokens = r._sum.tokensUsed ?? 0;
    const plan = org?.subscription?.plan ?? null;
    const monthlyRevenue = plan ? (PLAN_MONTHLY_REVENUE[plan] ?? 0) : 0;
    const cost = estimateCost(tokens, null);
    return {
      orgId: r.organizationId ?? "",
      orgName: org?.name ?? "Unknown",
      subscriptionStatus: org?.subscriptionStatus ?? null,
      plan,
      messages: r._count._all,
      tokens,
      estimatedCost: cost,
      monthlyRevenue,
      costRevenueRatio: monthlyRevenue > 0 ? cost / monthlyRevenue : null,
    };
  });

  const topOrgs = enrichedOrgUsage.slice(0, 20);
  const activeOrgs30d = orgUsageRaw.length;

  const trialOrgs = enrichedOrgUsage.filter((o) => o.subscriptionStatus === "TRIALING");
  const paidOrgs = enrichedOrgUsage.filter((o) => o.subscriptionStatus === "ACTIVE");
  const avgField = (arr: typeof enrichedOrgUsage, field: "tokens" | "estimatedCost") =>
    arr.length ? arr.reduce((s, o) => s + o[field], 0) / arr.length : 0;

  return {
    stats: {
      totalTokens30d,
      totalTokensAllTime,
      estimatedCost30d: estimateCost(totalTokens30d, null),
      totalMessages30d,
      activeOrgs30d,
    },
    byAgent: agentRows,
    byModel: modelRows,
    topOrgs,
    tokenTrend: buildTokenBuckets(trendMessages, 12, now),
    trialVsPaid: {
      trial: {
        orgCount: trialOrgs.length,
        avgTokens: Math.round(avgField(trialOrgs, "tokens")),
        avgCost: avgField(trialOrgs, "estimatedCost"),
      },
      paid: {
        orgCount: paidOrgs.length,
        avgTokens: Math.round(avgField(paidOrgs, "tokens")),
        avgCost: avgField(paidOrgs, "estimatedCost"),
      },
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
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  const [org, agentCounts, socialAccounts, tokenAllTime, token30d, agentTokens30d, trendMessages] =
    await Promise.all([
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
      prisma.message.aggregate({
        _sum: { tokensUsed: true },
        where: { organizationId: id, role: "assistant" },
      }),
      prisma.message.aggregate({
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { organizationId: id, role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.groupBy({
        by: ["agent"],
        _sum: { tokensUsed: true },
        _count: { _all: true },
        where: { organizationId: id, role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.findMany({
        select: { createdAt: true, tokensUsed: true },
        where: { organizationId: id, role: "assistant", createdAt: { gte: eightWeeksAgo } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const agentMap: Record<string, number> = {};
  for (const r of agentCounts) agentMap[r.agent] = r._count._all;

  const total30dTokens = token30d._sum.tokensUsed ?? 0;
  const tokenUsageByAgent = ALL_AGENTS.map((a) => {
    const row = agentTokens30d.find((r) => r.agent === a);
    const tokens = row?._sum.tokensUsed ?? 0;
    return {
      agent: a.charAt(0) + a.slice(1).toLowerCase(),
      messages: row?._count._all ?? 0,
      tokens,
      estimatedCost: estimateCost(tokens, null),
    };
  });

  return {
    ...org,
    agentActivity: ALL_AGENTS.map((a) => ({
      agent: a,
      messages: agentMap[a] ?? 0,
    })),
    connectedPlatforms: socialAccounts.map((s) => s.platform),
    tokenUsage: {
      totalAllTime: tokenAllTime._sum.tokensUsed ?? 0,
      total30d: total30dTokens,
      estimatedCost30d: estimateCost(total30dTokens, null),
      messages30d: token30d._count._all,
      byAgent: tokenUsageByAgent,
      weeklyTrend: buildTokenBuckets(trendMessages, 8, now),
    },
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
