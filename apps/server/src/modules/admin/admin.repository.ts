import { prisma } from "../../config/prisma.js";
import { buildSignupBuckets, buildHealthBuckets, buildTokenBuckets } from "./admin.charts.js";
import { estimateCost, PLAN_MONTHLY_REVENUE } from "./admin.costs.js";
import { computeOrgHealth } from "./admin.health.js";
import { extendTrialForOrg } from "../billing/billing.service.js";
import { getCurrentUsage, adjustCurrentPeriodUsage } from "../agents/maya/maya.usage.service.js";
import {
  FeedbackStatus,
  FeedbackCategory,
  ActivityAction,
} from "../../../prisma/generated/prisma/client.js";

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
    totalActiveOrgs,
    activeOrgs7dRaw,
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
    prisma.organization.count({
      where: { subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } },
    }),
    prisma.message.groupBy({
      by: ["organizationId"],
      where: { role: "assistant", createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const totalTokens30d = tokenTotals30d._sum.tokensUsed ?? 0;
  const platformHealthScore =
    totalActiveOrgs > 0
      ? Math.round((activeOrgs7dRaw.length / totalActiveOrgs) * 100)
      : 0;

  const [onboardingFunnel, churnRisk, attentionList] = await Promise.all([
    getOnboardingFunnel(),
    getChurnRiskOrgs(),
    getAttentionList(),
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
      totalTokens30d,
      estimatedCost30d: estimateCost(totalTokens30d, null),
      activeOrgs30d: activeOrgsRaw.length,
      platformHealthScore,
    },
    charts: {
      signupsPerWeek: buildSignupBuckets(orgsForCharts, 12, now),
      healthPerWeek: buildHealthBuckets(orgsForCharts, 12, now),
      agentPopularity: agentCounts.map((r) => ({
        agent: r.agent.charAt(0) + r.agent.slice(1).toLowerCase(),
        messages: r._count._all,
      })),
    },
    onboardingFunnel,
    churnRisk,
    attentionList,
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

  const orgIds = orgs.map((o) => o.id);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Batch health queries
  const [msgs7d, agentOrgs30d, socialByOrg, brandKits] = await Promise.all([
    prisma.message.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds }, role: "assistant", createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["organizationId", "agent"],
      where: { organizationId: { in: orgIds }, role: "assistant", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.socialAccount.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds } },
      _count: { _all: true },
    }),
    orgIds.length
      ? prisma.brandKit.findMany({
          where: { organizationId: { in: orgIds } },
          select: { organizationId: true, company_description: true, crawled_at: true },
        })
      : Promise.resolve([]),
  ]);

  const msgs7dMap = new Map(msgs7d.map((r) => [r.organizationId, r._count._all]));

  // Count distinct agents per org
  const agentCountMap = new Map<string, number>();
  for (const r of agentOrgs30d) {
    const orgId = r.organizationId;
    agentCountMap.set(orgId, (agentCountMap.get(orgId) ?? 0) + 1);
  }

  const socialSet = new Set(socialByOrg.map((r) => r.organizationId));
  const brandKitMap = new Map(brandKits.map((b) => [b.organizationId, b]));

  return {
    orgs: orgs.map((o) => {
      const bk = brandKitMap.get(o.id);
      const health = computeOrgHealth({
        subscriptionStatus: o.subscriptionStatus,
        messagesLast7d: msgs7dMap.get(o.id) ?? 0,
        messagesLast30d: 0,
        agentsUsedLast30d: agentCountMap.get(o.id) ?? 0,
        hasSocialAccount: socialSet.has(o.id),
        hasBrandKitDescription: !!(bk?.company_description),
        hasBrandKitCrawled: !!(bk?.crawled_at),
        memberCount: o.members.length,
      });
      return {
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
        health,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getOrganizationById(id: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

  const [
    org,
    agentCounts,
    socialAccounts,
    tokenAllTime,
    token30d,
    agentTokens30d,
    trendMessages,
    contentIdeasAll,
    contentIdeasPublished,
    publishedPostsByStatus,
    publishedPostsByPlatform,
    vegaFollowUps,
    recentFailedPosts,
  ] = await Promise.all([
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
    prisma.mayaContentIdea.count({ where: { organizationId: id } }),
    prisma.mayaContentIdea.count({ where: { organizationId: id, isPublished: true } }),
    prisma.publishedPost.groupBy({
      by: ["status"],
      where: { organizationId: id },
      _count: { _all: true },
    }),
    prisma.publishedPost.groupBy({
      by: ["platform"],
      where: { organizationId: id },
      _count: { _all: true },
    }),
    prisma.vegaFollowUp.findMany({
      where: { organizationId: id, status: { in: ["PENDING", "OVERDUE"] } },
      select: {
        id: true,
        emailSubject: true,
        senderEmail: true,
        dueAt: true,
        draftText: true,
        status: true,
        createdAt: true,
      },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    getOrgFailedPosts(id),
  ]);

  const agentMap: Record<string, number> = {};
  for (const r of agentCounts) agentMap[r.agent] = r._count._all;

  const mayaCredits = org.subscription ? await getCurrentUsage(id) : null;

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
    mayaCredits,
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
    contentStats: {
      ideasTotal: contentIdeasAll,
      ideasPublished: contentIdeasPublished,
      postsByStatus: publishedPostsByStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      postsByPlatform: publishedPostsByPlatform.map((r) => ({
        platform: r.platform,
        count: r._count._all,
      })),
    },
    vegaFollowUps,
    recentFailedPosts,
  };
}

export async function extendTrial(id: string, days = 7) {
  // Delegates entirely to the entitlements-based helper, which only ever
  // touches TRIAL-sourced Entitlement rows — it can't disturb a paying org's
  // CREW/AGENT entitlements — and itself throws when the org has no trial
  // entitlement rows to extend, which is the only eligibility guard needed
  // now that trial state no longer lives on the denormalized Subscription.
  return extendTrialForOrg(id, days);
}

export async function setSubscriptionStatus(orgId: string, status: string) {
  await prisma.organization.update({
    where: { id: orgId },
    data: { subscriptionStatus: status as any },
  });
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: { status: status as any },
  });
  return { id: orgId, subscriptionStatus: status };
}

export async function bulkExtendTrial(orgIds: string[], days: number) {
  // Degrade gracefully instead of rejecting the whole batch: each org is
  // extended independently, and one with no trial entitlement rows (rejected
  // by extendTrialForOrg) is reported as skipped rather than aborting the
  // rest.
  const results = await Promise.allSettled(orgIds.map((id) => extendTrialForOrg(id, days)));
  const extended = orgIds.filter((_, i) => results[i]!.status === "fulfilled");
  const skipped = orgIds.filter((_, i) => results[i]!.status === "rejected");

  return { extended: extended.length, orgIds: extended, skipped };
}

export async function grantCredits(organizationId: string, credits: number) {
  const before = await getCurrentUsage(organizationId);
  await adjustCurrentPeriodUsage(organizationId, -credits);
  const after = await getCurrentUsage(organizationId);
  return {
    organizationId,
    requested: credits,
    applied: before.credits.used - after.credits.used,
    before: before.credits,
    after: after.credits,
  };
}

export async function getChurnRiskOrgs() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [pastDueOrgs, trialingOrgs, activeOrgs] = await Promise.all([
    prisma.organization.findMany({
      where: { subscriptionStatus: "PAST_DUE" },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: { select: { plan: true } },
        members: { select: { role: true } },
      },
    }),
    prisma.organization.findMany({
      where: { subscriptionStatus: "TRIALING" },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: { select: { plan: true } },
        members: { select: { role: true } },
      },
    }),
    prisma.organization.findMany({
      where: { subscriptionStatus: "ACTIVE" },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: { select: { plan: true } },
        members: { select: { role: true } },
      },
    }),
  ]);

  const allOrgIds = [...pastDueOrgs, ...trialingOrgs, ...activeOrgs].map((o) => o.id);
  const lastMessages = await prisma.message.groupBy({
    by: ["organizationId"],
    where: { organizationId: { in: allOrgIds }, role: "assistant" },
    _max: { createdAt: true },
  });
  const lastMsgMap = new Map(lastMessages.map((r) => [r.organizationId, r._max.createdAt]));

  const results: Array<{
    id: string;
    name: string;
    subscriptionStatus: string | null;
    plan: string | null;
    lastActive: Date | null;
    riskReason: string;
    healthScore: number;
    healthLabel: string;
  }> = [];

  for (const org of pastDueOrgs) {
    const lastActive = lastMsgMap.get(org.id) ?? null;
    results.push({
      id: org.id,
      name: org.name,
      subscriptionStatus: org.subscriptionStatus,
      plan: org.subscription?.plan ?? null,
      lastActive,
      riskReason: "Past due payment",
      healthScore: 0,
      healthLabel: "At Risk",
    });
  }

  for (const org of trialingOrgs) {
    const lastActive = lastMsgMap.get(org.id) ?? null;
    const hasRecentMsg = lastActive && lastActive >= sevenDaysAgo;
    if (!hasRecentMsg) {
      results.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        lastActive,
        riskReason: "Trialing — no activity in 7 days",
        healthScore: 0,
        healthLabel: "At Risk",
      });
    }
  }

  for (const org of activeOrgs) {
    const lastActive = lastMsgMap.get(org.id) ?? null;
    const hasRecentMsg = lastActive && lastActive >= thirtyDaysAgo;
    if (!hasRecentMsg) {
      results.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        lastActive,
        riskReason: "Active — no usage in 30 days",
        healthScore: 0,
        healthLabel: "At Risk",
      });
    }
  }

  return results;
}

export async function getAttentionList() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [pastDueOrgs, trialingExpiring, recentMessages7d, ghostOrgs, failedPostOrgs] =
    await Promise.all([
      prisma.organization.findMany({
        where: { subscriptionStatus: "PAST_DUE" },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          entitlementExpiresAt: true,
          subscription: { select: { plan: true } },
        },
      }),
      prisma.organization.findMany({
        where: {
          subscriptionStatus: "TRIALING",
          entitlementExpiresAt: { lte: threeDaysFromNow, gte: now },
        },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          entitlementExpiresAt: true,
          subscription: { select: { plan: true } },
        },
      }),
      prisma.message.groupBy({
        by: ["organizationId"],
        where: { role: "assistant", createdAt: { gte: sevenDaysAgo } },
        _count: { _all: true },
      }),
      prisma.organization.findMany({
        where: { subscriptionStatus: "ACTIVE" },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          entitlementExpiresAt: true,
          subscription: { select: { plan: true } },
        },
      }),
      prisma.publishedPost.groupBy({
        by: ["organizationId"],
        where: { status: "failed", createdAt: { gte: fortyEightHoursAgo } },
        _count: { _all: true },
      }),
    ]);

  const recentMsgMap = new Map(recentMessages7d.map((r) => [r.organizationId, r._count._all]));
  const failedPostOrgIds = new Set(failedPostOrgs.map((r) => r.organizationId));

  const activeOrgIds = ghostOrgs.map((o) => o.id);
  const lastMessages30d =
    activeOrgIds.length > 0
      ? await prisma.message.groupBy({
          by: ["organizationId"],
          where: {
            organizationId: { in: activeOrgIds },
            role: "assistant",
            createdAt: { gte: thirtyDaysAgo },
          },
          _count: { _all: true },
        })
      : [];
  const active30dSet = new Set(lastMessages30d.map((r) => r.organizationId));

  type AttentionItem = {
    id: string;
    name: string;
    subscriptionStatus: string | null;
    plan: string | null;
    urgencyReason: string;
    urgencyScore: number;
    action: "extend-trial" | "view";
    entitlementExpiresAt: string | null;
  };

  const items: AttentionItem[] = [];

  for (const org of pastDueOrgs) {
    const msgs = recentMsgMap.get(org.id) ?? 0;
    if (msgs > 0) {
      items.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        urgencyReason: `Past due — still active (${msgs} messages/7d)`,
        urgencyScore: 4,
        action: "view",
        entitlementExpiresAt: org.entitlementExpiresAt?.toISOString() ?? null,
      });
    }
  }

  for (const org of trialingExpiring) {
    const msgs = recentMsgMap.get(org.id) ?? 0;
    if (msgs >= 3) {
      items.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        urgencyReason: `Trial expires soon — ${msgs} messages/7d`,
        urgencyScore: 3,
        action: "extend-trial",
        entitlementExpiresAt: org.entitlementExpiresAt?.toISOString() ?? null,
      });
    }
  }

  for (const org of ghostOrgs) {
    if (!active30dSet.has(org.id)) {
      items.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        urgencyReason: "Active subscription — no usage in 30 days",
        urgencyScore: 2,
        action: "view",
        entitlementExpiresAt: org.entitlementExpiresAt?.toISOString() ?? null,
      });
    }
  }

  if (failedPostOrgs.length > 0) {
    const failedOrgDetails = await prisma.organization.findMany({
      where: { id: { in: failedPostOrgs.map((r) => r.organizationId!).filter(Boolean) } },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        entitlementExpiresAt: true,
        subscription: { select: { plan: true } },
      },
    });
    for (const org of failedOrgDetails) {
      const count = failedPostOrgs.find((r) => r.organizationId === org.id)?._count._all ?? 0;
      items.push({
        id: org.id,
        name: org.name,
        subscriptionStatus: org.subscriptionStatus,
        plan: org.subscription?.plan ?? null,
        urgencyReason: `${count} failed post(s) in last 48h`,
        urgencyScore: 1,
        action: "view",
        entitlementExpiresAt: org.entitlementExpiresAt?.toISOString() ?? null,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = items
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

  return deduped;
}

export async function getOnboardingFunnel() {
  const [
    totalOrgs,
    brandKitCreatedOrgs,
    orgsWithMessages,
    orgsWithSocial,
    orgsWithPublished,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.brandKit.count({ where: { company_description: { not: "" } } }),
    prisma.message
      .groupBy({ by: ["organizationId"], where: { role: "assistant" } })
      .then((r) => r.length),
    prisma.socialAccount.groupBy({ by: ["organizationId"] }).then((r) => r.length),
    prisma.publishedPost
      .groupBy({ by: ["organizationId"], where: { status: "published" } })
      .then((r) => r.length),
  ]);

  return {
    signedUp: totalOrgs,
    brandKitCreated: brandKitCreatedOrgs,
    firstMessage: orgsWithMessages,
    socialConnected: orgsWithSocial,
    publishedPost: orgsWithPublished,
  };
}

export async function getIntegrationStats() {
  const now = new Date();
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [platformAdoption, totalActiveOrgs, expiringTokensRaw, publishingStatsRaw] =
    await Promise.all([
      prisma.socialAccount.groupBy({ by: ["platform"], _count: { _all: true } }),
      prisma.organization.count({
        where: { subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } },
      }),
      prisma.socialAccount.findMany({
        where: { accessTokenExpiresAt: { not: null, lte: fourteenDaysFromNow } },
        select: {
          id: true,
          platform: true,
          accountName: true,
          accessTokenExpiresAt: true,
          organizationId: true,
        },
        orderBy: { accessTokenExpiresAt: "asc" },
      }),
      prisma.publishedPost.groupBy({
        by: ["platform", "status"],
        _count: { _all: true },
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

  const orgIds = [...new Set(expiringTokensRaw.map((t) => t.organizationId))];
  const orgs = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const orgNameMap = new Map(orgs.map((o) => [o.id, o.name]));

  const expiringTokens = expiringTokensRaw.map((t) => ({
    id: t.id,
    orgId: t.organizationId,
    orgName: orgNameMap.get(t.organizationId) ?? "Unknown",
    platform: t.platform,
    accountName: t.accountName ?? null,
    accessTokenExpiresAt: t.accessTokenExpiresAt!.toISOString(),
    status: t.accessTokenExpiresAt! <= now ? "expired" : "expiring",
  }));

  const platforms = ["TWITTER", "LINKEDIN", "INSTAGRAM"] as const;

  const publishingStats = platforms.map((platform) => {
    const rows = publishingStatsRaw.filter((r) => r.platform === platform);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const published = rows.find((r) => r.status === "published")?._count._all ?? 0;
    const failed = rows.find((r) => r.status === "failed")?._count._all ?? 0;
    return {
      platform,
      total,
      published,
      failed,
      successRate: total > 0 ? Math.round((published / total) * 100) : 0,
    };
  });

  const adoption = platforms.map((platform) => {
    const count = platformAdoption.find((r) => r.platform === platform)?._count._all ?? 0;
    return {
      platform,
      orgCount: count,
      pctOfActiveOrgs: totalActiveOrgs > 0 ? Math.round((count / totalActiveOrgs) * 100) : 0,
    };
  });

  return { adoption, expiringTokens, publishingStats };
}

export async function getAgentAdoptionStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalActiveOrgs,
    agentOrgUsage,
    agentDepth30d,
    totalTokens30d,
    contentIdeas30d,
    contentIdeasPublished,
    publishedPostsByStatus,
    savedKeywordStats,
    lexSources,
    rexDatasets,
    rexSettings,
    rexPinnedCards,
    scoutCompetitors,
    scoutSources,
    vegaFollowUps,
    vegaFollowUpsSent,
    vegaFollowUpsOverdue,
    vegaVIPContacts,
    vegaBriefings,
  ] = await Promise.all([
    prisma.organization.count({ where: { subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } } }),
    Promise.all(
      ALL_AGENTS.map((agent) =>
        prisma.message
          .groupBy({
            by: ["organizationId"],
            where: { agent, role: "assistant" },
          })
          .then((rows) => ({ agent, orgCount: rows.length }))
      )
    ),
    prisma.message.groupBy({
      by: ["agent"],
      _count: { _all: true },
      _sum: { tokensUsed: true },
      where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.message.aggregate({
      _sum: { tokensUsed: true },
      where: { role: "assistant", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.mayaContentIdea.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.mayaContentIdea.count({ where: { isPublished: true, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.publishedPost.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.sageSavedKeyword.aggregate({
      _count: { _all: true },
      _avg: { estimatedDifficulty: true },
    }),
    prisma.lexSource.aggregate({
      _count: { _all: true },
      _avg: { pageCount: true, chunksCreated: true },
      where: { agent: "LEX" },
    }),
    prisma.rexDataset.count(),
    prisma.rexSettings.count({ where: { ingestApiKey: { not: null } } }),
    prisma.rexPinnedCard.count(),
    Promise.resolve({ _count: { _all: 0 } }),
    Promise.resolve(0),
    prisma.vegaFollowUp.count(),
    prisma.vegaFollowUp.count({ where: { status: "SENT" } }),
    prisma.vegaFollowUp.count({ where: { status: "OVERDUE" } }),
    prisma.vIPContact.aggregate({ _count: { _all: true } }),
    prisma.vegaBriefingCache.count(),
  ]);

  const totalPlatformTokens = totalTokens30d._sum.tokensUsed ?? 0;
  const agentOrgCountMap = new Map(agentOrgUsage.map((r) => [r.agent, r.orgCount]));

  const agentDepthTable = ALL_AGENTS.map((agent) => {
    const depth = agentDepth30d.find((r) => r.agent === agent);
    const msgs = depth?._count._all ?? 0;
    const tokens = depth?._sum.tokensUsed ?? 0;
    const orgCount = agentOrgCountMap.get(agent) ?? 0;
    return {
      agent,
      orgsUsingIt: orgCount,
      pctActiveOrgs: totalActiveOrgs > 0 ? Math.round((orgCount / totalActiveOrgs) * 100) : 0,
      totalMessages30d: msgs,
      avgMessagesPerOrg: orgCount > 0 ? Math.round(msgs / orgCount) : 0,
      totalTokens30d: tokens,
      pctPlatformTokens:
        totalPlatformTokens > 0 ? Math.round((tokens / totalPlatformTokens) * 100) : 0,
    };
  });

  const [keywordOrgCount, easyKw, medKw, hardKw, scoutOrgCount, vegaOrgCount] = await Promise.all([
    prisma.sageSavedKeyword.groupBy({ by: ["organizationId"] }).then((r) => r.length),
    prisma.sageSavedKeyword.count({ where: { estimatedDifficulty: { lte: 33 } } }),
    prisma.sageSavedKeyword.count({ where: { estimatedDifficulty: { gt: 33, lte: 66 } } }),
    prisma.sageSavedKeyword.count({ where: { estimatedDifficulty: { gt: 66 } } }),
    Promise.resolve(0),
    prisma.vIPContact.groupBy({ by: ["organizationId"] }).then((r) => r.length),
  ]);

  return {
    agentAdoption: agentOrgUsage.map((r) => ({
      agent: r.agent,
      orgCount: r.orgCount,
      pctActiveOrgs: totalActiveOrgs > 0 ? Math.round((r.orgCount / totalActiveOrgs) * 100) : 0,
    })),
    agentDepth: agentDepthTable,
    agentSpecific: {
      maya: {
        ideasGenerated30d: contentIdeas30d,
        ideasPublished30d: contentIdeasPublished,
        conversionPct:
          contentIdeas30d > 0
            ? Math.round((contentIdeasPublished / contentIdeas30d) * 100)
            : 0,
        postsByStatus: publishedPostsByStatus.map((r) => ({
          status: r.status,
          count: r._count._all,
        })),
      },
      sage: {
        totalKeywords: savedKeywordStats._count._all,
        avgKeywordsPerOrg:
          keywordOrgCount > 0
            ? Math.round(savedKeywordStats._count._all / keywordOrgCount)
            : 0,
        difficultyDistribution: { easy: easyKw, medium: medKw, hard: hardKw },
      },
      lex: {
        totalSources: lexSources._count._all,
        avgPageCount: Math.round(lexSources._avg.pageCount ?? 0),
        avgChunksCreated: Math.round(lexSources._avg.chunksCreated ?? 0),
      },
      rex: {
        totalDatasets: rexDatasets,
        datasetsWithApiKey: rexSettings,
        weeklyDigestOrgs: 0,
        totalPinnedCards: rexPinnedCards,
      },
      scout: {
        totalCompetitors: scoutCompetitors._count._all,
        avgCompetitorsPerOrg:
          scoutOrgCount > 0
            ? Math.round(scoutCompetitors._count._all / scoutOrgCount)
            : 0,
        totalSourceUploads: scoutSources,
      },
      vega: {
        totalFollowUps: vegaFollowUps,
        sentFollowUps: vegaFollowUpsSent,
        completionPct:
          vegaFollowUps > 0 ? Math.round((vegaFollowUpsSent / vegaFollowUps) * 100) : 0,
        overdueFollowUps: vegaFollowUpsOverdue,
        totalVIPContacts: vegaVIPContacts._count._all,
        avgVIPPerOrg: vegaOrgCount > 0 ? Math.round(vegaVIPContacts._count._all / vegaOrgCount) : 0,
        totalBriefings: vegaBriefings,
      },
    },
  };
}

export async function getRecentFailedPosts(limit = 20) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const posts = await prisma.publishedPost.findMany({
    where: { status: "failed", createdAt: { gte: sevenDaysAgo } },
    select: { id: true, organizationId: true, platform: true, error: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const orgIds = [...new Set(posts.map((p) => p.organizationId))];
  const orgs = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : [];
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));
  return posts.map((p) => ({
    ...p,
    orgName: orgMap.get(p.organizationId) ?? "Unknown",
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getOrgFailedPosts(orgId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.publishedPost.findMany({
    where: { organizationId: orgId, status: "failed", createdAt: { gte: sevenDaysAgo } },
    select: { id: true, platform: true, error: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getOrgVegaFollowUps(orgId: string) {
  return prisma.vegaFollowUp.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["PENDING", "OVERDUE"] },
    },
    select: {
      id: true,
      emailSubject: true,
      senderEmail: true,
      dueAt: true,
      draftText: true,
      status: true,
      createdAt: true,
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function verifyUserEmail(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
    select: { id: true, email: true, emailVerified: true },
  });
}

export async function revokeUserSessions(userId: string) {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return { userId, sessionsRevoked: result.count };
}

export async function deleteUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
  return { deleted: true, userId };
}

export async function listUsers(params: {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  banned?: boolean;
}) {
  const { page, search, banned } = params;
  const pageSize = params.limit ?? PAGE_SIZE;
  const skip = params.offset !== undefined ? params.offset : ((page ?? 1) - 1) * pageSize;

  const where: {
    OR?: { name?: object; email?: object }[];
    banned?: boolean;
  } = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (banned !== undefined) {
    where.banned = banned;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        banned: true,
        banReason: true,
        role: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page: page ?? 1, pageSize };
}

export async function listWaitlistEntries(params: {
  cursor?: string;
  limit?: number;
  search?: string;
}) {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const where = params.search
    ? { email: { contains: params.search, mode: "insensitive" as const } }
    : {};

  const [entries, total] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where,
      select: {
        id: true,
        email: true,
        coupon: true,
        validTill: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    prisma.waitlistEntry.count({ where }),
  ]);

  const hasMore = entries.length > limit;
  const pageEntries = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? pageEntries.at(-1)?.id ?? null : null;

  return {
    entries: pageEntries,
    nextCursor,
    hasMore,
    total,
    pageSize: limit,
  };
}

export async function listActivity(params: {
  cursor?: string;
  limit?: number;
  userId?: string;
  action?: ActivityAction;
  search?: string;
}) {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);

  const where: {
    userId?: string;
    action?: ActivityAction;
    user?: { OR: { name?: object; email?: object }[] };
  } = {};
  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.search) {
    where.user = {
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ],
    };
  }

  const [entries, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        summary: true,
        metadata: true,
        organizationId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    prisma.activityLog.count({ where }),
  ]);

  const hasMore = entries.length > limit;
  const pageEntries = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? pageEntries.at(-1)?.id ?? null : null;

  return {
    entries: pageEntries,
    nextCursor,
    hasMore,
    total,
    pageSize: limit,
  };
}

export async function exportOrganizationsCsv() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscriptionStatus: true,
      subscription: { select: { plan: true } },
      members: {
        select: { role: true, user: { select: { email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const orgIds = orgs.map((o) => o.id);
  const tokenRows = orgIds.length
    ? await prisma.message.groupBy({
        by: ["organizationId"],
        _sum: { tokensUsed: true },
        where: { organizationId: { in: orgIds }, role: "assistant", createdAt: { gte: thirtyDaysAgo } },
      })
    : [];
  const tokenMap = new Map(tokenRows.map((r) => [r.organizationId, r._sum.tokensUsed ?? 0]));

  const header = "id,name,status,plan,ownerEmail,memberCount,createdAt,tokens30d\n";
  const rows = orgs.map((o) => {
    const owner = o.members.find((m) => m.role === "owner")?.user.email ?? "";
    const tokens30d = tokenMap.get(o.id) ?? 0;
    return [
      o.id,
      `"${o.name.replace(/"/g, '""')}"`,
      o.subscriptionStatus ?? "",
      o.subscription?.plan ?? "",
      owner,
      o.members.length,
      o.createdAt.toISOString(),
      tokens30d,
    ].join(",");
  });

  return header + rows.join("\n");
}

export async function exportUsersCsv() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      banned: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const header = "id,name,email,emailVerified,createdAt,banned\n";
  const rows = users.map((u) =>
    [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.emailVerified,
      u.createdAt.toISOString(),
      u.banned ?? false,
    ].join(",")
  );

  return header + rows.join("\n");
}

// ── Feedback (admin) ──────────────────────────────────────────────────────────

export async function listFeedbackAdmin(filters: {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  agentSlug?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { status, category, agentSlug, search, page = 1, limit = 25 } = filters;
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(agentSlug ? { agentSlug } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.feedbackPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { voteCount: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        agentSlug: true,
        status: true,
        voteCount: true,
        adminReply: true,
        adminNote: true,
        roadmapEta: true,
        isMerged: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.feedbackPost.count({ where }),
  ]);

  return { data, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getFeedbackComments(feedbackId: string) {
  return prisma.feedbackComment.findMany({
    where: { feedbackId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      isAdminReply: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateFeedbackStatusAdmin(
  feedbackId: string,
  data: {
    status: FeedbackStatus;
    adminReply?: string | null;
    adminNote?: string | null;
    roadmapEta?: string | null;
  },
) {
  return prisma.feedbackPost.update({
    where: { id: feedbackId },
    data: {
      status: data.status,
      adminReply: data.adminReply ?? null,
      adminNote: data.adminNote ?? null,
      roadmapEta: data.roadmapEta ?? null,
    },
  });
}

export async function listUpcomingAgentsAdmin() {
  return prisma.upcomingAgent.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      emoji: true,
      color: true,
      order: true,
      isVisible: true,
      voteCount: true,
    },
  });
}

export async function createUpcomingAgentAdmin(data: {
  name: string;
  tagline: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  order?: number;
  isVisible?: boolean;
}) {
  return prisma.upcomingAgent.create({ data });
}

export async function updateUpcomingAgentAdmin(
  id: string,
  data: Partial<{
    name: string;
    tagline: string;
    description: string | null;
    emoji: string | null;
    color: string | null;
    order: number;
    isVisible: boolean;
  }>,
) {
  return prisma.upcomingAgent.update({ where: { id }, data });
}

export async function deleteUpcomingAgentAdmin(id: string) {
  await prisma.upcomingAgentVote.deleteMany({ where: { upcomingAgentId: id } });
  return prisma.upcomingAgent.delete({ where: { id } });
}

export async function getFeedbackStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, newThisWeek, byStatus, byCategory, topVoted] = await Promise.all([
    prisma.feedbackPost.count(),
    prisma.feedbackPost.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.feedbackPost.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.feedbackPost.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.feedbackPost.findMany({
      orderBy: { voteCount: "desc" },
      take: 5,
      select: { id: true, title: true, voteCount: true },
    }),
  ]);

  const byStatusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const byCategoryMap = Object.fromEntries(byCategory.map((c) => [c.category, c._count._all]));

  return {
    total,
    newThisWeek,
    byStatus: byStatusMap as Record<string, number>,
    byCategory: byCategoryMap as Record<string, number>,
    topVoted,
  };
}
