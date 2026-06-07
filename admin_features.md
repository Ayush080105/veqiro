 Admin Portal: Comprehensive Feature Expansion Plan

 Context

 The existing admin portal covers: subscription health overview, org list, org detail, usage/cost analytics, and basic user ban/unban. This plan covers
 everything else — organized by what an admin actually needs day-to-day. All features are backed by data that already exists in the DB; nothing requires
 schema migrations.

 The user asked for 7 categories:
 1. Admin actions on data/users/DB
 2. Useful insights from customer data
 3. Tracking / evaluation / analysis
 4. Standout / unique things
 5. Tedious manual tasks made easy
 6. Social media / external platform analytics
 7. Agent-specific insights

 Everything below is implementable against the existing Prisma schema.

 ---
 Feature Group A — Admin Power Actions

 Things admin needs to do but can't do today. All backed by existing better-auth admin plugin methods and existing billing service.

 A1. User Management Expansion (Users page)

 Extend the existing /users page with new action columns:

 Verify Email — authClient.admin.verifyEmail({ userId }) marks User.emailVerified = true. Useful when a user says they didn't get the email or when
 debugging onboarding.

 Revoke All Sessions — authClient.admin.revokeAllSessions({ userId }) signs out all devices. Critical for security incidents (compromised account,
 suspicious activity).

 Delete Account — authClient.admin.deleteUser({ userId }) with a two-step confirmation modal. Shows a warning if user is the owner of an org.

 Each new action is a small inline button next to the existing Ban/Unban button. No new page needed.

 Files to change:
 - apps/admin/src/components/users/UsersClient.tsx — add 3 action buttons

 ---
 A2. Flexible Trial Management (Org Detail page)

 Replace the hardcoded "Extend Trial +7 days" with a dialog that lets the admin choose days (7/14/30/custom). Also add:

 Force Subscription Status — A select dropdown + confirm to manually set subscriptionStatus to any value (TRIALING/ACTIVE/PAST_DUE/CANCELLED/EXPIRED).
 Required when Dodo webhooks fail silently or when doing manual customer support overrides.

 Re-sync with Dodo — A button that calls a new backend endpoint that re-fetches subscription state from DodoPayments API and reconciles with the DB. Saves
 the admin from manually fixing webhook failures by poking the DB.

 Backend changes:
 - admin.repository.ts — add setSubscriptionStatus(orgId, status) and resyncSubscription(orgId)
 - apps/server/src/modules/billing/billing.service.ts — add getSubscriptionFromDodo(dodoSubscriptionId) that calls DodoPayments SDK to fetch current
 subscription state
 - admin.routes.ts / admin.controller.ts — 2 new PATCH routes

 Frontend changes:
 - apps/admin/src/components/orgs/ExtendTrialButton.tsx — replace with TrialManagementButton.tsx dialog
 - apps/admin/src/app/(portal)/organizations/[id]/page.tsx — add Force Status + Re-sync buttons in Subscription section

 ---
 A3. Bulk Trial Extension (Organizations list)

 Add multi-select checkboxes to the org table. When 2+ orgs selected, show a floating action bar at the bottom: "Extend trial for X orgs" with a day-count
 input. Targets: orgs where subscriptionStatus = TRIALING and entitlementExpiresAt is within 7 days — the default filter for the checkbox column.

 Backend: Add POST /admin/organizations/bulk-extend-trial that accepts { orgIds: string[], days: number } and loops through extendTrial().

 Files: OrgsClient.tsx, new backend route.

 ---
 Feature Group B — Platform & Integration Intelligence

 New /integrations page — answers "which social platforms are most used across all customers".

 B1. New /integrations Admin Page

 Section 1: Platform Adoption (platform-wide)

 A bar chart + stat cards showing:
 - How many orgs have connected Twitter / LinkedIn / Instagram
 - % of active orgs that have each platform connected
 - Which platform is most popular

 Query: prisma.socialAccount.groupBy({ by: ['platform'], _count: { _all: true } }) grouped across all orgs.

 Section 2: Expiring OAuth Tokens

 A table of SocialAccount records where accessTokenExpiresAt is within the next 14 days or already expired. Columns: Org Name | Platform | Account Name |
 Expires At | Status.

 This is the critical operational view — an admin can see which customers are about to lose their social posting capability before they notice. Clicking
 the org name links to the org detail page.

 Query: prisma.socialAccount.findMany({ where: { accessTokenExpiresAt: { lte: fourteenDaysFromNow } }, include: { organization: true } })

 Section 3: Publishing Success Rates by Platform

 A table showing per-platform post statistics (last 30 days):
 Platform | Total Posts | Published | Failed | Success Rate %

 Query: prisma.publishedPost.groupBy({ by: ['platform', 'status'], _count: true, where: { createdAt: { gte: thirtyDaysAgo } } })

 Files to create:
 - apps/admin/src/app/(portal)/integrations/page.tsx
 - apps/admin/src/components/integrations/IntegrationsClient.tsx
 - apps/server/src/modules/admin/admin.repository.ts — add getIntegrationStats()
 - apps/server/src/modules/admin/admin.routes.ts — add GET /admin/integrations

 ---
 Feature Group C — Agent Analytics & Adoption

 New /agents admin page + agent-level insights on org detail.

 C1. Agent Adoption Matrix — New /agents Page

 Section 1: Platform-wide agent adoption

 6 stat cards (one per agent): what % of active orgs have ever used this agent (sent ≥1 message to it).

 Query: prisma.message.groupBy({ by: ['organizationId', 'agent'], where: { role: 'assistant' } }) — distinct orgs per agent.

 Section 2: Agent Usage Depth (30d)

 Table with a row per agent: Agent | Orgs Using It | Total Messages | Avg Messages/Org | Total Tokens | % of Platform Tokens

 This immediately shows: which agents are popular across many orgs vs. which have a few very heavy users.

 Section 3: Agent-Specific Feature Metrics

 Each agent has unique data tables. Show one sub-section per agent with its key metric:

 - Maya: ContentIdea count (total ideas generated, last 30d) / PublishedPost count by status / idea-to-publish conversion %
 - Sage: SavedKeyword count across all orgs / avg keywords per org / difficulty score distribution
 - Lex: Source uploads to Lex (from Source table filtered by agent=LEX) / avg page count / avg chunks created
 - Rex: RexDataset count / datasets with ingestApiKey / weeklyDigestEnabled adoption % / RexPinnedCard count
 - Scout: CompetitorWatch count / avg competitors per org / Source uploads to Scout
 - Vega: VegaFollowUp completion rate (SENT/total) / overdue follow-up count / VIPContact avg per org / briefing types generated

 Files to create:
 - apps/admin/src/app/(portal)/agents/page.tsx
 - apps/admin/src/components/agents/AgentsClient.tsx
 - Backend: getAgentAdoptionStats() in admin.repository.ts
 - Route: GET /admin/agents

 ---
 Feature Group D — Customer Health Scoring

 The most unique and standout feature. A composite health score per org that makes churn prediction obvious at a glance.

 D1. Org Health Score

 Every org gets a score from 0–100 computed in the backend from weighted signals:

 ┌────────────────────────────────────────┬──────────┬─────────────────────────────────┐
 │                 Signal                 │  Weight  │           Max Points            │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ Subscription ACTIVE                    │ required │ — (TRIALING/PAST_DUE cap at 70) │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ Messages in last 7 days ≥ 1            │ 20       │ 20                              │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ Messages in last 7 days ≥ 10           │ +10      │ 30 total                        │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ ≥ 2 agents used (last 30d)             │ 15       │ 15                              │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ Social account connected               │ 10       │ 10                              │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ BrandKit company_description filled    │ 10       │ 10                              │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ BrandKit crawled (crawled_at not null) │ 10       │ 10                              │
 ├────────────────────────────────────────┼──────────┼─────────────────────────────────┤
 │ Members > 1 (team adoption)            │ 5        │ 5                               │
 └────────────────────────────────────────┴──────────┴─────────────────────────────────┘

 Score 80–100 = Healthy (green) · 50–79 = Watch (yellow) · 0–49 = At Risk (red)

 This score is added to:
 1. The org list table — new "Health" column with colored badge
 2. The org detail page header area
 3. A new /health overview section

 Backend: Add computeOrgHealth(orgData) function in a new admin.health.ts. Compute per-org score inside listOrganizations() (add required fields to the
 select) and getOrganizationById().

 D2. Churn Risk List — New section on /overview

 Below the existing stat cards, add a "Churn Risk" table showing orgs that match ANY of:
 - subscriptionStatus = 'PAST_DUE'
 - subscriptionStatus = 'TRIALING' AND no messages in last 7 days
 - subscriptionStatus = 'ACTIVE' AND no messages in last 30 days (ghost customers — paying but not using)

 Table columns: Org | Plan | Status | Last Active | Risk Reason | Health Score | Action (Extend Trial / View)

 This is the most operationally useful single view — tells the admin exactly who to reach out to without any manual SQL.

 Backend: Add getChurnRiskOrgs() to admin.repository.ts. Runs prisma.organization.findMany for the three risk conditions + joins last message date.

 Files:
 - apps/server/src/modules/admin/admin.health.ts — NEW: health score computation
 - apps/server/src/modules/admin/admin.repository.ts — add getChurnRiskOrgs(), enrich listOrganizations() with health score
 - apps/admin/src/components/overview/ChurnRiskTable.tsx — NEW: churn risk section
 - apps/admin/src/components/overview/OverviewClient.tsx — add churn risk table below stats

 ---
 Feature Group E — Operational Headache Reduction

 Things that are currently either impossible or require DB access.

 E1. Data Export (CSV)

 Add an "Export CSV" button to:
 1. Organizations list — exports all orgs with name, plan, status, owner email, member count, created date, token usage
 2. Users list — exports all users with name, email, verified status, created date, org membership, banned status

 Backend: Add GET /admin/organizations/export and GET /admin/users/export that stream CSV using standard Node.js stream + csv-stringify (or manual
 comma-join).

 Frontend: Simple download button that calls the endpoint with credentials: include, triggers browser file save.

 E2. Onboarding Completion Funnel — New section on /overview

 A simple horizontal funnel showing platform-wide onboarding completion:

 Signed Up → BrandKit Created → First Message → Social Connected → Published Post
   100%   →       67%        →      54%       →       38%        →      22%

 Each step is a count of orgs that have reached that milestone. Tells the admin exactly where users drop off.

 Queries:
 - BrandKit created: prisma.brandKit.count({ where: { company_description: { not: "" } } })
 - First message: prisma.message.groupBy({ by: ['organizationId'] }) → distinct count
 - Social connected: prisma.socialAccount.groupBy({ by: ['organizationId'] }) → distinct count
 - Published post: prisma.publishedPost.count({ where: { status: 'published' } }) distinct orgs

 Backend: Add getOnboardingFunnel() to admin.repository.ts, add to /admin/overview response.
 Frontend: Simple funnel bar in OverviewClient.tsx.

 E3. Failed Content Monitor

 A small table showing recent PublishedPost records with status = 'failed' (last 7 days), grouped by org. Columns: Org | Platform | Error Message | Created
 At.

 Surfacing these in the admin portal means the admin can proactively reach out to orgs whose posts are silently failing, rather than waiting for them to
 complain.

 Added to the org detail page (already has "Agent Activity" section) and as a small widget on Overview.

 Backend: Add getRecentFailedPosts(limit) and getOrgFailedPosts(orgId) to admin.repository.ts.

 ---
 Feature Group F — Content & Activity Feed

 F1. Vega Overdue Follow-ups (Org Detail)

 On the org detail page, add a "Vega Tasks" section showing VegaFollowUp records for this org where status = 'OVERDUE' or status = 'PENDING'. Table: Email
 Subject | Due At | Status | Draft Preview.

 Useful for support conversations ("your follow-up on the Smith contract is overdue").

 Backend: Add getOrgVegaFollowUps(orgId) to admin.repository.ts.
 Frontend: New <section> on organizations/[id]/page.tsx.

 F2. Content Velocity (Org Detail)

 On the org detail page, add a "Content" section showing for this org:
 - Ideas generated (ContentIdea count)
 - Ideas published (ContentIdea where isPublished=true)
 - Posts by status: published / failed / pending
 - Posts by platform (bar chart — reuse OrgTokenChart pattern)

 Backend: Enrich getOrganizationById() with content stats.
 Frontend: New section on org detail page.

 ---
 Feature Group G — Standout / Unique Features

 G1. Platform Health Score Card (on Overview)

 A single bold number showing "Platform Health" — computed from:
 - % of active orgs who used any agent in last 7 days
 - Weighted by subscription plan (ANNUAL orgs count more)
 - Shown as a score 0–100 with a historical trend line

 This is a vanity/morale metric — when product is growing and users are active, this number goes up. Not actionable on its own but psychologically useful.

 G2. "Who Needs Attention" Smart List

 A smart-sorted list of orgs that need attention RIGHT NOW, scored by urgency:
 1. PAST_DUE orgs with recent activity (they want to use it but can't pay — easiest to save)
 2. TRIALING orgs expiring in <3 days with high usage (hot leads for conversion)
 3. ACTIVE orgs with zero messages in 30 days (ghost customers at churn risk)
 4. Orgs with failed social posts in last 48h (technical issue they may not know about)

 Each item in the list has a one-click action (Extend Trial / Contact / View).

 This list replaces the need to manually cross-reference multiple tables — it's curated urgency. Add as a prominent section at the top of /overview above
 the stat cards.

 Backend: A single getAttentionList() query in admin.repository.ts that unions the four conditions with their urgency score.
 Frontend: AttentionList.tsx component in components/overview/.

 ---
 Implementation Priority Order

 ┌───────┬────────────────────────────────┬───────────┬────────┐
 │ Group │            Feature             │  Impact   │ Effort │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ D2    │ Churn Risk List on Overview    │ Very High │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ G2    │ "Who Needs Attention" list     │ Very High │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ B1    │ Integrations page              │ High      │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ A1    │ User management expansion      │ High      │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ E2    │ Onboarding funnel              │ High      │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ C1    │ Agent adoption matrix          │ High      │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ D1    │ Org health score               │ Medium    │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ E1    │ CSV export                     │ Medium    │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ E3    │ Failed content monitor         │ Medium    │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ A2    │ Flexible trial + force status  │ Medium    │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ F2    │ Content velocity on org detail │ Medium    │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ F1    │ Vega follow-up on org detail   │ Low       │ Low    │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ A3    │ Bulk trial extension           │ Low       │ Medium │
 ├───────┼────────────────────────────────┼───────────┼────────┤
 │ G1    │ Platform health score card     │ Low       │ Low    │
 └───────┴────────────────────────────────┴───────────┴────────┘

 ---
 New Pages Summary

 ┌────────────────────────┬──────────────┬───────────────────────────────────────────────────────────┐
 │          Page          │ Sidebar Item │                        Description                        │
 ├────────────────────────┼──────────────┼───────────────────────────────────────────────────────────┤
 │ /integrations          │ Integrations │ Platform adoption, expiring tokens, post success rates    │
 ├────────────────────────┼──────────────┼───────────────────────────────────────────────────────────┤
 │ /agents                │ Agents       │ Per-agent adoption rates + agent-specific feature metrics │
 ├────────────────────────┼──────────────┼───────────────────────────────────────────────────────────┤
 │ (section on /overview) │ —            │ "Who Needs Attention" + Churn Risk + Onboarding Funnel    │
 └────────────────────────┴──────────────┴───────────────────────────────────────────────────────────┘

 ---
 New Backend Endpoints Summary

 ┌─────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
 │                                      Endpoint                                       │                       Description                        │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ GET /admin/integrations                                                             │ Platform adoption + expiring tokens + post success rates │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ GET /admin/agents                                                                   │ Agent adoption matrix + per-agent feature stats          │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ GET /admin/organizations/export                                                     │ CSV export of all orgs                                   │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ GET /admin/users/export                                                             │ CSV export of all users                                  │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ PATCH /admin/organizations/:id/subscription-status                                  │ Force subscription status                                │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ POST /admin/organizations/:id/subscription-sync                                     │ Re-sync with Dodo                                        │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ POST /admin/organizations/bulk-extend-trial                                         │ Bulk trial extension                                     │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ GET /admin/users/:id/sessions                                                       │ List active sessions                                     │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ DELETE /admin/users/:id/sessions                                                    │ Revoke all sessions                                      │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ POST /admin/users/:id/verify-email                                                  │ Force email verification                                 │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ DELETE /admin/users/:id                                                             │ Delete user account                                      │
 ├─────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 │ Overview response enriched with: onboarding funnel, churn risk orgs, attention list │                                                          │
 └─────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘

 ---
 New Files Summary

 ┌───────────────────────────────────────────────────────────────┬────────────────────────────────┐
 │                             File                              │              Type              │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/server/src/modules/admin/admin.health.ts                 │ NEW — health score computation │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/app/(portal)/integrations/page.tsx             │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/integrations/IntegrationsClient.tsx │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/app/(portal)/agents/page.tsx                   │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/agents/AgentsClient.tsx             │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/overview/AttentionList.tsx          │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/overview/ChurnRiskTable.tsx         │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/overview/OnboardingFunnel.tsx       │ NEW                            │
 ├───────────────────────────────────────────────────────────────┼────────────────────────────────┤
 │ apps/admin/src/components/orgs/TrialManagementButton.tsx      │ replaces ExtendTrialButton     │
 └───────────────────────────────────────────────────────────────┴────────────────────────────────┘

 ---
 Key Existing Utilities to Reuse

 - buildTokenBuckets() in admin.charts.ts — for any weekly trend
 - estimateCost() in admin.costs.ts — for any cost display
 - StatChip pattern in UsageClient.tsx — for custom formatted stat cards
 - OrgTokenChart in components/orgs/OrgTokenChart.tsx — for small bar charts
 - apiFetch() in apps/admin/src/lib/api.ts — all API calls
 - authClient.admin.* in apps/admin/src/lib/auth-client.ts — user management actions

 ---
 Verification

 For each new page: navigate to it in the running admin app and confirm data renders correctly.
 For each new action: perform the action and verify the DB state changed (check org detail / user detail).
 Type check after implementation: cd apps/admin && pnpm check-types and cd apps/server && pnpm tsc --noEmit.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
