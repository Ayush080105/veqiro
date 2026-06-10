─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
     │ Veqiro: User Feedback & Voting System — Design Plan                                                                                                 │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Context                                                                                                                                             │
     │                                                                                                                                                     │
     │ What is Veqiro?                                                                                                                                     │
     │ Veqiro is a B2B SaaS AI agent workforce platform. Users get a "crew" of 6 specialized AI employees: Vega (Executive Assistant), Scout (Researcher), │
     │ Maya (Content/Marketing), Sage (SEO), Lex (Legal), and Rex (Data/Finance). It's a Next.js 16 + Prisma/PostgreSQL + shadcn/ui monorepo with          │
     │ apps/main (the dashboard) and apps/landing (the marketing site).                                                                                    │
     │                                                                                                                                                     │
     │ Why this feature?                                                                                                                                   │
     │ Currently there's no way for users to voice what they want, upvote ideas others have suggested, or know what's coming. This kills community trust   │
     │ and product-market fit signal. Adding a structured feedback and voting system turns users into co-creators, shows momentum, and gives the team a    │
     │ prioritization signal grounded in real demand.                                                                                                      │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ What We're Building: The Full System                                                                                                                │
     │                                                                                                                                                     │
     │ Three interconnected surfaces:                                                                                                                      │
     │                                                                                                                                                     │
     │ 1. Feedback Portal — Inside the main app (/feedback). Logged-in users submit requests and upvote.                                                   │
     │ 2. Upcoming Agents Voting — A dedicated section showing unreleased agents users can vote to prioritize.                                             │
     │ 3. Public Roadmap — A page on the landing site (or a public URL) anyone can view without logging in — read-only vote counts and statuses.           │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ User Flow                                                                                                                                           │
     │                                                                                                                                                     │
     │ Flow A: A user wants to give feedback on Sage (SEO agent)                                                                                           │
     │                                                                                                                                                     │
     │ 1. User clicks "Feedback" in the main app sidebar (below existing nav items)                                                                        │
     │ 2. Lands on the Feedback Board — sees a list of cards with vote counts, statuses, and categories                                                    │
     │ 3. Sees a card "Sage should support bulk keyword exports" — clicks upvote ↑ (one click, instant)                                                    │
     │ 4. Or: Doesn't see what they want → clicks "Submit Feedback" button                                                                                 │
     │ 5. A modal/drawer opens:                                                                                                                            │
     │   - Step 1: Pick type — Feature Request | Bug Report | Integration Request | UX Improvement | General                                               │
     │   - Step 2: Tag the agent — Vega | Scout | Maya | Sage | Lex | Rex | Platform-Wide                                                                  │
     │   - Step 3: Write title + description                                                                                                               │
     │   - As they type, the system shows "Similar requests" below (prevents duplicates)                                                                   │
     │ 6. Submit → confirmation toast → item appears in the board instantly                                                                                │
     │                                                                                                                                                     │
     │ Flow B: A user wants to vote on which new agent comes next                                                                                          │
     │                                                                                                                                                     │
     │ 1. On the Feedback Board, there's a prominent section at the top: "Vote for Veqiro's Next Crew Member"                                              │
     │ 2. Shows 3-5 cards for upcoming/planned agents (e.g., "Aria – Customer Support Agent", "Max – Sales Outreach Agent")                                │
     │ 3. Each card has a name, one-line description, icon/color, and vote count                                                                           │
     │ 4. User clicks "Vote" on their preferred agent — they can vote on multiple upcoming agents                                                          │
     │ 5. The most-voted agent gets built first (this signal is communicated explicitly)                                                                   │
     │                                                                                                                                                     │
     │ Flow C: A visitor on the landing site wants to see the roadmap                                                                                      │
     │                                                                                                                                                     │
     │ 1. Landing site footer or nav has a "Roadmap" link                                                                                                  │
     │ 2. Goes to a public /roadmap page showing:                                                                                                          │
     │   - Now — items In Progress                                                                                                                         │
     │   - Next — items Planned                                                                                                                            │
     │   - Later — items Under Review                                                                                                                      │
     │   - Shipped — Launched                                                                                                                              │
     │ 3. Vote counts are visible, but to vote they must sign up/log in (CTA)                                                                              │
     │                                                                                                                                                     │
     │ Flow D: Admin/team responds to a top-voted request                                                                                                  │
     │                                                                                                                                                     │
     │ 1. Admin goes to /settings/feedback (or a dedicated admin panel)                                                                                    │
     │ 2. Sees all submissions sorted by votes                                                                                                             │
     │ 3. Can: Change status, pin an admin reply, merge duplicates, decline with explanation                                                               │
     │ 4. When status changes → email notification goes to everyone who upvoted that item                                                                  │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Feature Breakdown                                                                                                                                   │
     │                                                                                                                                                     │
     │ 1. Feedback Board (/feedback in main app)                                                                                                           │
     │                                                                                                                                                     │
     │ Filters & Sorting:                                                                                                                                  │
     │ - Filter by: Category | Agent | Status                                                                                                              │
     │ - Sort by: Top Voted | Newest | Trending (vote velocity in last 7 days)                                                                             │
     │ - Search bar                                                                                                                                        │
     │                                                                                                                                                     │
     │ Feedback Card (list view):                                                                                                                          │
     │ [↑ 234]  [PLANNED] [Sage]  Bulk keyword export to CSV                                                                                               │
     │          Feature Request · 12 comments · Posted 3 days ago                                                                                          │
     │                                                                                                                                                     │
     │ Feedback Detail Page (/feedback/[id]):                                                                                                              │
     │ - Title, full description, agent tag, category, status badge                                                                                        │
     │ - Large upvote button with count                                                                                                                    │
     │ - Admin reply (pinned, highlighted in a distinct box)                                                                                               │
     │ - Roadmap ETA if status is Planned ("Targeting Q3 2026")                                                                                            │
     │ - Comment thread (logged-in users only to comment)                                                                                                  │
     │ - "Watch this" toggle — opt-in for email updates                                                                                                    │
     │                                                                                                                                                     │
     │ 2. Upcoming Agents Voting Section                                                                                                                   │
     │                                                                                                                                                     │
     │ - Displayed as a banner/section at the top of /feedback                                                                                             │
     │ - Each upcoming agent card:                                                                                                                         │
     │   - Name, emoji/icon, color accent (matching existing agent design system)                                                                          │
     │   - One-sentence pitch: "Aria handles customer support tickets, live chat escalation, and refund processing"                                        │
     │   - Vote count + Vote button                                                                                                                        │
     │   - User can vote on multiple upcoming agents (unlike a single-choice poll)                                                                         │
     │ - Admin controls: add/remove/edit upcoming agents from an admin panel                                                                               │
     │ - The vote data is separate from the main feedback posts (its own model)                                                                            │
     │                                                                                                                                                     │
     │ 3. Public Roadmap (/roadmap on landing site)                                                                                                        │
     │                                                                                                                                                     │
     │ - Kanban-style or timeline-style layout                                                                                                             │
     │ - Columns: Planned → In Progress → Shipped                                                                                                          │
     │ - Items are read-only (no voting without login)                                                                                                     │
     │ - "Have feedback? Join Veqiro" CTA button                                                                                                           │
     │ - Link to the full feedback portal                                                                                                                  │
     │                                                                                                                                                     │
     │ 4. Admin Management                                                                                                                                 │
     │                                                                                                                                                     │
     │ - Accessible to organization owners / admins inside /settings/feedback or a standalone /admin/feedback                                              │
     │ - Features:                                                                                                                                         │
     │   - View all posts sorted by votes                                                                                                                  │
     │   - Change status (dropdown)                                                                                                                        │
     │   - Write admin reply (public)                                                                                                                      │
     │   - Write internal note (private, not shown to users)                                                                                               │
     │   - Merge duplicate posts (select target → all votes consolidate)                                                                                   │
     │   - Decline with reason (auto-notifies voters)                                                                                                      │
     │   - Manage upcoming agents (add/remove/reorder)                                                                                                     │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Data Model (New Prisma Models)                                                                                                                      │
     │                                                                                                                                                     │
     │ model FeedbackPost {                                                                                                                                │
     │   id           String           @id @default(cuid())                                                                                                │
     │   title        String                                                                                                                               │
     │   description  String                                                                                                                               │
     │   category     FeedbackCategory                                                                                                                     │
     │   status       FeedbackStatus   @default(NEW)                                                                                                       │
     │   agentSlug    String?          // "vega" | "scout" | "maya" | "sage" | "lex" | "rex" | null                                                        │
     │   createdById  String                                                                                                                               │
     │   createdBy    User             @relation(fields: [createdById], references: [id])                                                                  │
     │   voteCount    Int              @default(0)                                                                                                         │
     │   votes        FeedbackVote[]                                                                                                                       │
     │   comments     FeedbackComment[]                                                                                                                    │
     │   adminReply   String?          // Public pinned response                                                                                           │
     │   adminNote    String?          // Internal only                                                                                                    │
     │   roadmapEta   String?          // e.g., "Q3 2026"                                                                                                  │
     │   mergedIntoId String?                                                                                                                              │
     │   mergedInto   FeedbackPost?    @relation("MergedPosts", fields: [mergedIntoId], references: [id])                                                  │
     │   mergedPosts  FeedbackPost[]   @relation("MergedPosts")                                                                                            │
     │   createdAt    DateTime         @default(now())                                                                                                     │
     │   updatedAt    DateTime         @updatedAt                                                                                                          │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ enum FeedbackCategory {                                                                                                                             │
     │   FEATURE_REQUEST                                                                                                                                   │
     │   BUG_REPORT                                                                                                                                        │
     │   INTEGRATION                                                                                                                                       │
     │   NEW_AGENT                                                                                                                                         │
     │   UX_IMPROVEMENT                                                                                                                                    │
     │   GENERAL                                                                                                                                           │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ enum FeedbackStatus {                                                                                                                               │
     │   NEW                                                                                                                                               │
     │   UNDER_REVIEW                                                                                                                                      │
     │   PLANNED                                                                                                                                           │
     │   IN_PROGRESS                                                                                                                                       │
     │   LAUNCHED                                                                                                                                          │
     │   DECLINED                                                                                                                                          │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ model FeedbackVote {                                                                                                                                │
     │   id         String       @id @default(cuid())                                                                                                      │
     │   userId     String                                                                                                                                 │
     │   user       User         @relation(fields: [userId], references: [id])                                                                             │
     │   feedbackId String                                                                                                                                 │
     │   feedback   FeedbackPost @relation(fields: [feedbackId], references: [id])                                                                         │
     │   createdAt  DateTime     @default(now())                                                                                                           │
     │                                                                                                                                                     │
     │   @@unique([userId, feedbackId])                                                                                                                    │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ model FeedbackComment {                                                                                                                             │
     │   id           String       @id @default(cuid())                                                                                                    │
     │   content      String                                                                                                                               │
     │   userId       String                                                                                                                               │
     │   user         User         @relation(fields: [userId], references: [id])                                                                           │
     │   feedbackId   String                                                                                                                               │
     │   feedback     FeedbackPost @relation(fields: [feedbackId], references: [id])                                                                       │
     │   isAdminReply Boolean      @default(false)                                                                                                         │
     │   createdAt    DateTime     @default(now())                                                                                                         │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ model UpcomingAgent {                                                                                                                               │
     │   id          String              @id @default(cuid())                                                                                              │
     │   name        String                                                                                                                                │
     │   tagline     String                                                                                                                                │
     │   description String?                                                                                                                               │
     │   emoji       String?                                                                                                                               │
     │   color       String?                                                                                                                               │
     │   voteCount   Int                 @default(0)                                                                                                       │
     │   votes       UpcomingAgentVote[]                                                                                                                   │
     │   order       Int                 @default(0)                                                                                                       │
     │   isVisible   Boolean             @default(true)                                                                                                    │
     │   createdAt   DateTime            @default(now())                                                                                                   │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ model UpcomingAgentVote {                                                                                                                           │
     │   id              String        @id @default(cuid())                                                                                                │
     │   userId          String                                                                                                                            │
     │   user            User          @relation(fields: [userId], references: [id])                                                                       │
     │   upcomingAgentId String                                                                                                                            │
     │   upcomingAgent   UpcomingAgent @relation(fields: [upcomingAgentId], references: [id])                                                              │
     │   createdAt       DateTime      @default(now())                                                                                                     │
     │                                                                                                                                                     │
     │   @@unique([userId, upcomingAgentId])                                                                                                               │
     │ }                                                                                                                                                   │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Pages & Routes                                                                                                                                      │
     │                                                                                                                                                     │
     │ Main App (apps/main)                                                                                                                                │
     │                                                                                                                                                     │
     │ ┌────────────────────┬───────────────────────────────────────────────────────────────┐                                                              │
     │ │       Route        │                          Description                          │                                                              │
     │ ├────────────────────┼───────────────────────────────────────────────────────────────┤                                                              │
     │ │ /feedback          │ Main feedback board with vote cards + upcoming agents section │                                                              │
     │ ├────────────────────┼───────────────────────────────────────────────────────────────┤                                                              │
     │ │ /feedback/[id]     │ Individual feedback post detail + comments                    │                                                              │
     │ ├────────────────────┼───────────────────────────────────────────────────────────────┤                                                              │
     │ │ /feedback/submit   │ Submit new feedback (or modal on the board page)              │                                                              │
     │ ├────────────────────┼───────────────────────────────────────────────────────────────┤                                                              │
     │ │ /settings/feedback │ Admin panel: manage posts, statuses, upcoming agents          │                                                              │
     │ └────────────────────┴───────────────────────────────────────────────────────────────┘                                                              │
     │                                                                                                                                                     │
     │ Landing App (apps/landing)                                                                                                                          │
     │                                                                                                                                                     │
     │ ┌──────────┬──────────────────────────────────────────────┐                                                                                         │
     │ │  Route   │                 Description                  │                                                                                         │
     │ ├──────────┼──────────────────────────────────────────────┤                                                                                         │
     │ │ /roadmap │ Public read-only roadmap — no login required │                                                                                         │
     │ └──────────┴──────────────────────────────────────────────┘                                                                                         │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ UI Design Details                                                                                                                                   │
     │                                                                                                                                                     │
     │ Color coding for statuses (consistent badge system):                                                                                                │
     │ - NEW → gray                                                                                                                                        │
     │ - UNDER_REVIEW → yellow                                                                                                                             │
     │ - PLANNED → blue                                                                                                                                    │
     │ - IN_PROGRESS → orange/amber                                                                                                                        │
     │ - LAUNCHED → green                                                                                                                                  │
     │ - DECLINED → red/muted                                                                                                                              │
     │                                                                                                                                                     │
     │ Upcoming Agents Section Design:                                                                                                                     │
     │ - Horizontal card row or 2-column grid                                                                                                              │
     │ - Each card styled like the existing agent cards on the landing page (matching the Vega/Scout/Maya aesthetic)                                       │
     │ - "Voting closes when we start building" note                                                                                                       │
     │ - Progress bar showing relative vote share                                                                                                          │
     │                                                                                                                                                     │
     │ Feedback Board Layout:                                                                                                                              │
     │ [Submit Feedback]                    [Search...]                                                                                                    │
     │                                                                                                                                                     │
     │ ┌─ Vote for Next Crew Member ────────────────────────┐                                                                                              │
     │ │  [Aria 🎧 234 votes] [Max 📞 189 votes] [...]       │                                                                                             │
     │ └─────────────────────────────────────────────────────┘                                                                                             │
     │                                                                                                                                                     │
     │ Filters: [All] [Features] [Bugs] [Integrations]  Sort: [Top ▼]                                                                                      │
     │ Agent:   [All] [Vega] [Scout] [Maya] [Sage] ...                                                                                                     │
     │                                                                                                                                                     │
     │ [↑ 234] [PLANNED] Sage — Bulk keyword export to CSV        [Sage]                                                                                   │
     │         Feature Request · 12 comments · 3 days ago                                                                                                  │
     │                                                                                                                                                     │
     │ [↑ 156] [IN PROGRESS] Maya — Schedule posts from the app   [Maya]                                                                                   │
     │         Feature Request · 8 comments · 1 week ago                                                                                                   │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Email Notifications                                                                                                                                 │
     │                                                                                                                                                     │
     │ When status of a FeedbackPost changes → email sent to:                                                                                              │
     │ 1. The original submitter                                                                                                                           │
     │ 2. All users who upvoted the item                                                                                                                   │
     │ 3. All users who "watched" the item                                                                                                                 │
     │                                                                                                                                                     │
     │ Email content: "The feature you voted for — [Title] — has moved to [NEW STATUS]!" + link to the item.                                               │
     │                                                                                                                                                     │
     │ Use the existing @repo/transactional package (already in the monorepo) to build email templates with React Email / Resend.                          │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Implementation Phases                                                                                                                               │
     │                                                                                                                                                     │
     │ Phase 1 — MVP (Core Voting)                                                                                                                         │
     │                                                                                                                                                     │
     │ - Database schema (new Prisma models above)                                                                                                         │
     │ - Basic feedback board page with vote cards                                                                                                         │
     │ - Upvote/unvote toggle (logged-in only)                                                                                                             │
     │ - Submit feedback modal (title, description, category, agent tag)                                                                                   │
     │ - Simple duplicate suggestion (search by title keywords on submit)                                                                                  │
     │ - Individual feedback detail page                                                                                                                   │
     │ - Admin status management (basic)                                                                                                                   │
     │                                                                                                                                                     │
     │ Phase 2 — Upcoming Agents + Roadmap                                                                                                                 │
     │                                                                                                                                                     │
     │ - Upcoming Agents voting section on the feedback board                                                                                              │
     │ - Admin CRUD for upcoming agents                                                                                                                    │
     │ - Public roadmap page on landing site                                                                                                               │
     │ - Status badge system                                                                                                                               │
     │ - Admin reply/comment capability                                                                                                                    │
     │                                                                                                                                                     │
     │ Phase 3 — Notifications + Polish                                                                                                                    │
     │                                                                                                                                                     │
     │ - Email notifications on status change                                                                                                              │
     │ - Comment threads on feedback posts                                                                                                                 │
     │ - "Watch this item" toggle                                                                                                                          │
     │ - Merge duplicate posts                                                                                                                             │
     │ - Trending sort algorithm (vote velocity)                                                                                                           │
     │ - Roadmap ETA fields                                                                                                                                │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Key Technical Decisions                                                                                                                             │
     │                                                                                                                                                     │
     │ 1. Auth: Only logged-in users can vote or submit. Public roadmap is read-only (no auth required).                                                   │
     │ 2. Vote integrity: @@unique([userId, feedbackId]) at the DB level prevents double-voting — no need for complex rate limiting.                       │
     │ 3. voteCount field: Maintained as a denormalized counter (increment/decrement on vote toggle) for fast sorting. Source of truth is the FeedbackVote │
     │ table.                                                                                                                                              │
     │ 4. Submit flow: Use a modal (drawer) rather than a separate page — keeps users on the board so they can see similar requests while writing.         │
     │ 5. Admin panel: Integrated into /settings/feedback (matches existing settings layout) rather than a separate admin app.                             │
     │ 6. Upcoming agents: Managed by the Veqiro team via admin panel, not user-submitted. Users only vote, not propose.                                   │
     │                                                                                                                                                     │
     │ ---                                                                                                                                                 │
     │ Verification Plan                                                                                                                                   │
     │                                                                                                                                                     │
     │ After implementation:                                                                                                                               │
     │ 1. Create a feedback post as a test user → appears on board                                                                                         │
     │ 2. Upvote it → count increments; clicking again decrements                                                                                          │
     │ 3. Try submitting same vote twice → blocked at DB constraint                                                                                        │
     │ 4. Admin changes status → check email notification fires                                                                                            │
     │ 5. Check public roadmap is accessible without login                                                                                                 │
     │ 6. Check upcoming agent vote works and updates count                                                                                                │
     │ 7. Merge two duplicate posts → vote counts consolidate   