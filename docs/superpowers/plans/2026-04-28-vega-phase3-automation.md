# Vega Workspace Phase 3 — Automation & Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scheduled automation (cron jobs), evening/weekly briefing tabs, VIP contact management UI, post-meeting follow-up generation, and auto-reschedule with email draft to the Vega Workspace.

**Architecture:** Cron jobs follow the existing `rex.cron.ts` pattern (node-cron, not Trigger.dev — Trigger.dev is not installed). Each job queries the `Account` table for users with a Google OAuth connection, maps them to orgs via `Member`, then calls workspace service functions directly. New AI endpoints are added to `apps/ai/agents/vega/routes.py` using the same `_llm`, `_agent`, `safe_json_loads` globals already present. Frontend uses the established patterns: `apiFetch`, `useQuery`/`useMutation` (TanStack Query v5), `authClient.useActiveOrganization()`.

**Tech Stack:** Express 5 + Zod 4, node-cron 4, Prisma 7, FastAPI + Pydantic v2, Next.js 16 App Router, TanStack React Query v5, shadcn/ui, Sonner toasts, Lucide icons.

---

## Codebase conventions (read before writing any code)

- Cron pattern: export `startXCron()`, import in `apps/server/src/server.ts`, call inside `if (process.env.NODE_ENV === "production")`. See `apps/server/src/modules/agents/rex/rex.cron.ts` for the exact pattern.
- Google token: `getGoogleAccessToken(userId)` from `"../../../common/utils/googleAuth.js"` — throws `GoogleNotConnectedError` if not connected.
- AI service: `aiService.post<T>(path, body)` from `"../../../common/utils/aiService.js"`.
- Frontend API: `apiFetch<T>(path, opts)` from `"@/lib/api/client"` — body is auto-serialized.
- Query keys: all live in `apps/main/src/lib/query-keys.ts` in the `qk` object.
- `authClient.useActiveOrganization()` gives `activeOrg.id`.
- Briefing page (`apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`) is a `"use client"` component using `useState`/`useEffect` — NOT React Query. Match that pattern when adding tabs.
- `apps/main/src/lib/api/briefing.ts` has `getBriefing(organizationId)` (hardcodes MORNING) and `generateBriefing(type)` — both will be updated to accept a type param.
- `apps/main/src/lib/api/vega-vip.ts` already has `fetchVIPContacts`, `addVIPContact`, `removeVIPContact` — use these directly.
- `apps/server/src/common/utils/googleApis.ts` already has `createCalendarEvent`, `sendGmailReply` — add `updateCalendarEvent` in Task 7.
- Python AI routes use: `_llm.complete(...)`, `_agent.build_system_prompt(...)`, `safe_json_loads(...)`, `list_unread(...)`. All are already imported at module level in `routes.py`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/server/src/modules/agents/vega/vega.cron.ts` | Create | Scheduled Vega cron jobs (morning/evening briefing, follow-up check, weekly insights) |
| `apps/server/src/server.ts` | Modify | Import + call `startVegaCron()` |
| `apps/main/src/lib/api/briefing.ts` | Modify | Accept `type` param in `getBriefing` |
| `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx` | Modify | Add MORNING / EVENING / WEEKLY tabs |
| `apps/main/src/lib/query-keys.ts` | Modify | Add `vegaVIPContacts`, `vegaPostMeetingFollowup`, `vegaRescheduleDraft` |
| `apps/main/src/app/(dashboard)/settings/vega/page.tsx` | Create | VIP contact management settings page |
| `apps/ai/agents/vega/routes.py` | Modify | Add post-meeting-followup and reschedule-draft endpoints |
| `apps/server/src/modules/agents/vega/vega.workspace.schema.ts` | Modify | Add `postMeetingFollowUpSchema`, `sendFollowUpEmailSchema`, `updateCalendarEventSchema`, `rescheduleDraftSchema` |
| `apps/server/src/modules/agents/vega/vega.workspace.service.ts` | Modify | Add `getPostMeetingFollowUp`, `sendFollowUpEmail`, `updateCalendarEventWorkspace`, `getRescheduleDraft` |
| `apps/server/src/modules/agents/vega/vega.workspace.controller.ts` | Modify | Add 4 new handlers |
| `apps/server/src/modules/agents/vega/vega.routes.ts` | Modify | Add 4 new routes |
| `apps/server/src/common/utils/googleApis.ts` | Modify | Add `updateCalendarEvent` |
| `apps/main/src/lib/api/vega-calendar.ts` | Modify | Add `fetchPostMeetingFollowUp`, `sendFollowUpEmail`, `fetchRescheduleDraft`, `updateCalendarEvent` |
| `apps/main/src/components/vega/EventSidePanel.tsx` | Modify | Add post-meeting follow-up section + reschedule UI |

---

## Task 1: Vega cron jobs

**Files:**
- Create: `apps/server/src/modules/agents/vega/vega.cron.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Create `apps/server/src/modules/agents/vega/vega.cron.ts`**

```typescript
import cron from "node-cron";
import { prisma } from "../../../config/prisma.js";
import { generateAndCacheBriefing } from "./vega.workspace.service.js";

async function findOrgsWithGoogle(): Promise<
  Array<{ organizationId: string; userId: string }>
> {
  const googleAccounts = await prisma.account.findMany({
    where: { providerId: "google", accessToken: { not: null } },
    select: { userId: true },
  });
  if (googleAccounts.length === 0) return [];

  const userIds = googleAccounts.map((a) => a.userId);
  const members = await prisma.member.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, organizationId: true, role: true },
  });

  const orgMap = new Map<string, { organizationId: string; userId: string }>();
  for (const m of members) {
    const existing = orgMap.get(m.organizationId);
    if (!existing || m.role === "owner") {
      orgMap.set(m.organizationId, {
        organizationId: m.organizationId,
        userId: m.userId,
      });
    }
  }
  return Array.from(orgMap.values());
}

async function runBriefingForAllOrgs(type: "MORNING" | "EVENING" | "WEEKLY") {
  const orgs = await findOrgsWithGoogle();
  await Promise.allSettled(
    orgs.map(({ userId, organizationId }) =>
      generateAndCacheBriefing(userId, organizationId, {
        type,
        includeEmail: true,
        includeCalendar: true,
      }).catch((err) =>
        console.error(
          `[vega-cron] ${type} briefing failed for org ${organizationId}:`,
          err
        )
      )
    )
  );
  console.log(`[vega-cron] ${type} briefing generated for ${orgs.length} orgs`);
}

async function runFollowUpCheck() {
  const overdue = await prisma.vegaFollowUp.updateMany({
    where: {
      status: "PENDING",
      dueAt: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });
  if (overdue.count > 0) {
    console.log(`[vega-cron] Marked ${overdue.count} follow-ups as OVERDUE`);
  }
}

export function startVegaCron() {
  // Morning briefing — 08:00 UTC daily
  cron.schedule("0 8 * * *", () => {
    void runBriefingForAllOrgs("MORNING");
  });

  // Evening wrap-up — 18:00 UTC daily
  cron.schedule("0 18 * * *", () => {
    void runBriefingForAllOrgs("EVENING");
  });

  // Follow-up overdue check — 09:00 UTC daily
  cron.schedule("0 9 * * *", () => {
    void runFollowUpCheck();
  });

  // Weekly insights — Monday 08:00 UTC
  cron.schedule("0 8 * * 1", () => {
    void runBriefingForAllOrgs("WEEKLY");
  });

  console.log("[vega-cron] Scheduled: morning briefing, evening wrap-up, follow-up check, weekly insights");
}
```

- [ ] **Step 2: Add `startVegaCron` to `apps/server/src/server.ts`**

The current file contents:
```typescript
import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { startRexCron } from "./modules/agents/rex/rex.cron.js";

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  if (process.env.NODE_ENV === "production") {
    startRexCron();
  }
});
```

Replace with:
```typescript
import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { startRexCron } from "./modules/agents/rex/rex.cron.js";
import { startVegaCron } from "./modules/agents/vega/vega.cron.js";

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  if (process.env.NODE_ENV === "production") {
    startRexCron();
    startVegaCron();
  }
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.cron.ts apps/server/src/server.ts
git commit -m "feat(vega): add scheduled cron jobs (morning/evening briefing, follow-up check, weekly insights)"
```

---

## Task 2: Evening & weekly briefing tabs

**Files:**
- Modify: `apps/main/src/lib/api/briefing.ts`
- Modify: `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`

- [ ] **Step 1: Update `getBriefing` in `apps/main/src/lib/api/briefing.ts` to accept a type**

Find this function (lines 72–89):
```typescript
export async function getBriefing(_organizationId: string): Promise<Briefing> {
  // Try to get cached morning briefing
  const cache = await apiFetch<RawBriefingCache | null>(
    "/agents/vega/briefing?type=MORNING"
  ).catch(() => null);

  if (cache?.content) {
    return mapContentToBriefing(cache);
  }

  // No cache — generate fresh
  const fresh = await apiFetch<RawBriefingCache>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type: "MORNING" },
  });

  return mapContentToBriefing(fresh);
}
```

Replace with:
```typescript
export async function getBriefing(
  _organizationId: string,
  type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"
): Promise<Briefing> {
  const cache = await apiFetch<RawBriefingCache | null>(
    `/agents/vega/briefing?type=${type}`
  ).catch(() => null);

  if (cache?.content) {
    return mapContentToBriefing(cache);
  }

  const fresh = await apiFetch<RawBriefingCache>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type },
  });

  return mapContentToBriefing(fresh);
}
```

- [ ] **Step 2: Add tab state and type-aware loading to the briefing page**

In `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`, add the `Sun`, `Moon`, `BarChart2` icons to the lucide import:

```typescript
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  MessageSquare,
  AlertCircle,
  RotateCcw,
  Sun,
  Moon,
  BarChart2,
} from "lucide-react"
```

- [ ] **Step 3: Add the tab type definition and `BriefingTypeTabs` component directly above the `BriefingPage` function**

```typescript
type BriefingType = "MORNING" | "EVENING" | "WEEKLY"

const BRIEFING_TABS: Array<{
  type: BriefingType
  label: string
  icon: React.ElementType
  subtitle: string
}> = [
  {
    type: "MORNING",
    label: "Morning",
    icon: Sun,
    subtitle: "Your AI team's morning report — compiled fresh while you slept.",
  },
  {
    type: "EVENING",
    label: "Evening",
    icon: Moon,
    subtitle: "What got done today and what's coming tomorrow.",
  },
  {
    type: "WEEKLY",
    label: "Weekly",
    icon: BarChart2,
    subtitle: "This week vs last — response rates, busy senders, and trends.",
  },
]

function BriefingTypeTabs({
  active,
  onChange,
}: {
  active: BriefingType
  onChange: (t: BriefingType) => void
}) {
  return (
    <div className="flex gap-1" style={{ borderBottom: "2px solid #E5E5E5", paddingBottom: 0 }}>
      {BRIEFING_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.type === active
        return (
          <button
            key={tab.type}
            onClick={() => onChange(tab.type)}
            style={{
              padding: "6px 14px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              fontWeight: isActive ? 700 : 400,
              letterSpacing: 1,
              textTransform: "uppercase" as const,
              borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
              marginBottom: -2,
              background: "transparent",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: isActive ? "#111" : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: isActive ? "#111" : "#888",
            }}
          >
            <Icon size={12} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Update `BriefingPage` to use tabs**

Replace the `export default function BriefingPage()` function (lines 218–327) with:

```typescript
export default function BriefingPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [briefingType, setBriefingType] = useState<BriefingType>("MORNING")
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  const today = new Date()
  const activeTab = BRIEFING_TABS.find((t) => t.type === briefingType)!

  async function loadBriefing(type: BriefingType = briefingType, forceRefresh = false) {
    setLoading(true)
    setError(false)
    setBriefing(null)
    try {
      const data = forceRefresh
        ? await generateBriefing(type)
        : await getBriefing(organizationId, type)
      setBriefing(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBriefing(briefingType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, briefingType])

  // Highlight active TOC section on scroll
  useEffect(() => {
    if (!briefing) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            const match = id.match(/^section-(\d+)$/)
            if (match) setActiveIdx(parseInt(match[1]))
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    const els = document.querySelectorAll("[id^='section-']")
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [briefing])

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          kicker={formatBriefingDate(today)}
          title="daily briefing"
          subtitle={activeTab.subtitle}
          sticker={{ label: "today's brief", rot: -5, color: "var(--vq-green)" }}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-1 shrink-0"
          onClick={() => loadBriefing(briefingType, true)}
          disabled={loading}
        >
          <RefreshCw className={["size-3.5", loading ? "animate-spin" : ""].join(" ").trim()} />
          Refresh Briefing
        </Button>
      </div>

      <BriefingTypeTabs active={briefingType} onChange={(t) => setBriefingType(t)} />

      {loading ? (
        <BriefingLoadingSkeleton />
      ) : error ? (
        <BriefingError onRetry={() => loadBriefing(briefingType)} />
      ) : briefing ? (
        <div className="flex gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Card id="overview">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Executive Overview</CardTitle>
                <CardDescription>Compiled by your AI team</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs/relaxed italic text-muted-foreground">{briefing.overview}</p>
              </CardContent>
            </Card>
            {briefing.sections.map((section, i) => (
              <SectionCard key={i} section={section} index={i} />
            ))}
          </div>
          <aside className="hidden w-48 shrink-0 xl:block">
            <div className="sticky top-6">
              <TableOfContents sections={briefing.sections} activeIdx={activeIdx} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep -i "briefing" | head -10
```

Expected: no errors referencing briefing files.

- [ ] **Step 6: Commit**

```bash
git add apps/main/src/lib/api/briefing.ts \
        "apps/main/src/app/(dashboard)/workspace/briefing/page.tsx"
git commit -m "feat(vega): add MORNING/EVENING/WEEKLY briefing tabs to briefing page"
```

---

## Task 3: VIP contacts settings page

**Files:**
- Modify: `apps/main/src/lib/query-keys.ts`
- Create: `apps/main/src/app/(dashboard)/settings/vega/page.tsx`

- [ ] **Step 1: Add `vegaVIPContacts` to query keys**

In `apps/main/src/lib/query-keys.ts`, add inside the `qk` object (after `vegaMeetingPrep`):

```typescript
vegaVIPContacts: (organizationId: string) =>
  ["vega", "vip-contacts", organizationId] as const,
```

- [ ] **Step 2: Create the settings directory and page**

```bash
mkdir -p "apps/main/src/app/(dashboard)/settings/vega"
```

Create `apps/main/src/app/(dashboard)/settings/vega/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import {
  fetchVIPContacts,
  addVIPContact,
  removeVIPContact,
  type VIPContact,
} from "@/lib/api/vega-vip"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Star, Trash2, Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1.5px solid #111",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  background: "#fff",
  outline: "none",
}

export default function VegaSettingsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  const { data: contacts, isLoading, isError } = useQuery({
    queryKey: qk.vegaVIPContacts(organizationId),
    queryFn: fetchVIPContacts,
    enabled: !!organizationId,
  })

  const addMutation = useMutation({
    mutationFn: addVIPContact,
    onSuccess: () => {
      toast.success("VIP contact added")
      setEmail("")
      setName("")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to add VIP contact"),
  })

  const removeMutation = useMutation({
    mutationFn: removeVIPContact,
    onSuccess: () => {
      toast.success("VIP contact removed")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to remove VIP contact"),
  })

  const handleAdd = () => {
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    addMutation.mutate({ email: email.trim(), name: name.trim() || undefined })
  }

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-2xl">
      <PageHeader
        kicker="vega"
        title="VIP contacts"
        subtitle="Emails from VIP contacts are always surfaced at the top of your inbox, regardless of AI triage priority."
        sticker={{ label: "VIPs", rot: 2, color: "var(--vq-yellow)" }}
      />

      {/* Add form */}
      <div
        className="flex flex-col gap-3 p-4 rounded-xl"
        style={{ border: "2px solid #111", boxShadow: "3px 3px 0 #111", background: "#FFF9ED" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}
        >
          Add VIP Contact
        </span>
        <div className="flex gap-2">
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            size="sm"
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Contact list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="size-4" />
          Could not load VIP contacts
        </div>
      ) : contacts && contacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {contacts.map((contact: VIPContact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
              style={{ border: "1.5px solid #E5E5E5", background: "#fff" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Star className="size-3.5 shrink-0 fill-current" style={{ color: "#F5C518" }} />
                <div className="flex flex-col min-w-0">
                  {contact.name && (
                    <span className="text-xs font-semibold truncate">{contact.name}</span>
                  )}
                  <span
                    className="text-xs text-muted-foreground truncate"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {contact.email}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeMutation.mutate(contact.id)}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <Star className="size-8 opacity-20" />
          <p className="text-sm">No VIP contacts yet</p>
          <p className="text-xs text-center max-w-xs">
            Add email addresses above — Vega will always put their messages at the top of your inbox.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep -i "vega" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/lib/query-keys.ts \
        "apps/main/src/app/(dashboard)/settings/vega/page.tsx"
git commit -m "feat(vega): add VIP contacts management settings page"
```

---

## Task 4: Post-meeting follow-up AI endpoint

**Files:**
- Modify: `apps/ai/agents/vega/routes.py`

- [ ] **Step 1: Add `PostMeetingFollowUpRequest` and `PostMeetingFollowUpResponse` models after the `MeetingPrepResponse` class**

Find `class MeetingPrepResponse` in `apps/ai/agents/vega/routes.py` and add these two classes immediately after it:

```python
class PostMeetingFollowUpRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    event_title: str
    attendee_emails: list[str] = []
    description: str = ""
    notes: str = ""
    metadata: dict = {}


class PostMeetingFollowUpResponse(BaseModel):
    follow_up: dict
    action_items: list[str] = []
    tokens_used: int = 0
    model_used: str = ""
```

- [ ] **Step 2: Add the `POST /ai/vega/post-meeting-followup` route at the end of the file**

```python
@router.post("/post-meeting-followup", response_model=PostMeetingFollowUpResponse, summary="Post-meeting follow-up draft")
async def post_meeting_followup(request: PostMeetingFollowUpRequest) -> PostMeetingFollowUpResponse:
    """Generate a follow-up email draft and action item list after a meeting."""
    attendee_str = ", ".join(request.attendee_emails[:3]) or "attendees"
    if settings.MOCK_MODE:
        return PostMeetingFollowUpResponse(
            follow_up={
                "to": request.attendee_emails[0] if request.attendee_emails else "",
                "subject": f"Follow-up: {request.event_title}",
                "body": (
                    f"Hi {attendee_str},\n\n"
                    f"Thanks for joining our {request.event_title} call today. "
                    f"Here's a quick recap of what we discussed and the next steps.\n\n"
                    f"Please let me know if I missed anything.\n\nBest,"
                ),
            },
            action_items=[
                "Share meeting notes with all attendees by EOD",
                "Schedule follow-up call within 2 weeks",
                "Send over any documents mentioned during the call",
            ],
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    context = (
        f"Meeting: {request.event_title}\n"
        f"Attendees: {', '.join(request.attendee_emails)}\n"
        f"Description: {request.description}"
    )
    if request.notes:
        context += f"\nMeeting notes: {request.notes}"

    raw = await _llm.complete(
        provider=_agent.default_provider,
        model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Generate a professional post-meeting follow-up for:\n{context}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "follow_up (object with keys: to (first attendee email), subject (string), body (string — friendly professional follow-up email text)), "
            "action_items (list of strings — concrete next steps identified during the meeting)"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
    except Exception:
        data = {
            "follow_up": {
                "to": request.attendee_emails[0] if request.attendee_emails else "",
                "subject": f"Follow-up: {request.event_title}",
                "body": raw[:500],
            },
            "action_items": [],
        }
    return PostMeetingFollowUpResponse(
        follow_up=data.get("follow_up", {}),
        action_items=data.get("action_items", []),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )
```

- [ ] **Step 3: Verify Python syntax**

```bash
cd apps/ai && python -c "from agents.vega.routes import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/ai/agents/vega/routes.py
git commit -m "feat(vega/ai): add post-meeting-followup endpoint with mock + real LLM path"
```

---

## Task 5: Post-meeting follow-up Express layer

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.schema.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.service.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.controller.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.routes.ts`

- [ ] **Step 1: Add 2 new schemas to the end of `vega.workspace.schema.ts`**

```typescript
export const postMeetingFollowUpSchema = z.object({
  eventTitle: z.string().min(1).max(500),
  attendeeEmails: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export const sendFollowUpEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
});
```

- [ ] **Step 2: Add 2 new service functions to the end of `vega.workspace.service.ts`**

First add the new schema imports. The file currently imports these schema types:
```typescript
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
} from "./vega.workspace.schema.js";
```

Add the two new ones:
```typescript
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
} from "./vega.workspace.schema.js";
```

Then append these two functions at the end of `vega.workspace.service.ts`:

```typescript
// ─── Post-meeting follow-up ────────────────────────────────────────────────────

export interface PostMeetingFollowUp {
  followUp: { to: string; subject: string; body: string };
  actionItems: string[];
}

export const getPostMeetingFollowUp = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof postMeetingFollowUpSchema>
): Promise<PostMeetingFollowUp> => {
  let token = "";
  try {
    token = await requireGoogleToken(userId);
  } catch {
    // token is optional for follow-up generation
  }
  const { data } = await aiService.post<{
    follow_up: Record<string, unknown>;
    action_items: string[];
  }>("/ai/vega/post-meeting-followup", {
    user_id: userId,
    organization_id: organizationId,
    event_title: input.eventTitle,
    attendee_emails: input.attendeeEmails,
    description: input.description,
    notes: input.notes,
    metadata: { google_access_token: token },
  });

  const fu = data.follow_up ?? {};
  return {
    followUp: {
      to: String(fu.to ?? ""),
      subject: String(fu.subject ?? ""),
      body: String(fu.body ?? ""),
    },
    actionItems: Array.isArray(data.action_items)
      ? data.action_items.map(String)
      : [],
  };
};

export const sendFollowUpEmail = async (
  userId: string,
  input: z.infer<typeof sendFollowUpEmailSchema>
): Promise<{ messageId: string }> => {
  const token = await requireGoogleToken(userId);
  const sent = await sendGmailReply({
    accessToken: token,
    to: input.to,
    subject: input.subject,
    body: input.body,
    replyToMessageId: null,
    replyToThreadId: null,
  });
  return { messageId: sent.id };
};
```

- [ ] **Step 3: Add 2 new controller handlers to the end of `vega.workspace.controller.ts`**

First add schema imports. The existing import block has:
```typescript
import {
  getInboxSchema,
  sendReplySchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
} from "./vega.workspace.schema.js";
```

Replace with:
```typescript
import {
  getInboxSchema,
  sendReplySchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
  getCalendarSchema,
  createCalendarEventSchema,
  getMeetingPrepSchema,
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
} from "./vega.workspace.schema.js";
```

Then append at the end of `vega.workspace.controller.ts`:

```typescript
// Post-meeting follow-up
export const postMeetingFollowUpHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = postMeetingFollowUpSchema.parse(req.body);
  const result = await ws.getPostMeetingFollowUp(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const sendFollowUpEmailHandler = async (req: Request, res: Response) => {
  const { userId } = requireAuthContext(req);
  const input = sendFollowUpEmailSchema.parse(req.body);
  const result = await ws.sendFollowUpEmail(userId, input);
  res.status(StatusCodes.OK).json(result);
};
```

- [ ] **Step 4: Add 2 new routes to `vega.routes.ts`**

Add the handler imports:
```typescript
import {
  // ... existing imports ...
  postMeetingFollowUpHandler,
  sendFollowUpEmailHandler,
} from "./vega.workspace.controller.js";
```

Add the routes after the existing calendar routes:
```typescript
// workspace: post-meeting follow-up
router.post("/calendar/followup", postMeetingFollowUpHandler);
router.post("/calendar/followup/send", sendFollowUpEmailHandler);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.schema.ts \
        apps/server/src/modules/agents/vega/vega.workspace.service.ts \
        apps/server/src/modules/agents/vega/vega.workspace.controller.ts \
        apps/server/src/modules/agents/vega/vega.routes.ts
git commit -m "feat(vega): add post-meeting follow-up Express endpoints (generate + send)"
```

---

## Task 6: Post-meeting follow-up frontend

**Files:**
- Modify: `apps/main/src/lib/query-keys.ts`
- Modify: `apps/main/src/lib/api/vega-calendar.ts`
- Modify: `apps/main/src/components/vega/EventSidePanel.tsx`

- [ ] **Step 1: Add `vegaPostMeetingFollowup` to query keys**

In `apps/main/src/lib/query-keys.ts`, add inside `qk` after `vegaMeetingPrep`:

```typescript
vegaPostMeetingFollowup: (eventId: string) =>
  ["vega", "post-meeting-followup", eventId] as const,
```

- [ ] **Step 2: Add 2 new functions to `apps/main/src/lib/api/vega-calendar.ts`**

Add these interfaces and functions at the end of the file:

```typescript
export interface PostMeetingFollowUp {
  followUp: { to: string; subject: string; body: string }
  actionItems: string[]
}

export function fetchPostMeetingFollowUp(payload: {
  eventTitle: string
  attendeeEmails: string[]
  description: string
  notes?: string
}): Promise<PostMeetingFollowUp> {
  return apiFetch<PostMeetingFollowUp>("/agents/vega/calendar/followup", {
    method: "POST",
    body: payload,
  })
}

export function sendFollowUpEmail(payload: {
  to: string
  subject: string
  body: string
}): Promise<{ messageId: string }> {
  return apiFetch<{ messageId: string }>("/agents/vega/calendar/followup/send", {
    method: "POST",
    body: payload,
  })
}
```

- [ ] **Step 3: Add the post-meeting section to `EventSidePanel.tsx`**

Add `useMutation` to the existing react-query import in `EventSidePanel.tsx`:
```typescript
import { useQuery, useMutation } from "@tanstack/react-query"
```

Add `Send`, `RotateCcw` to the lucide import (it currently has `X, Video, Users, Sparkles`):
```typescript
import { X, Video, Users, Sparkles, Send, RotateCcw } from "lucide-react"
```

Add the new imports from vega-calendar:
```typescript
import {
  fetchMeetingPrep,
  fetchPostMeetingFollowUp,
  sendFollowUpEmail,
} from "@/lib/api/vega-calendar"
```

Add the `vegaPostMeetingFollowup` query key import (it's already `import { qk } from "@/lib/query-keys"`).

Add the `toast` import:
```typescript
import { toast } from "sonner"
```

Inside the `EventSidePanel` component body, add these after the existing `prepEnabled` state:

```typescript
const isPastEvent = new Date() > new Date(event.end)
const [followUpEnabled, setFollowUpEnabled] = useState(false)
const [followUpBody, setFollowUpBody] = useState("")
const [followUpNotes, setFollowUpNotes] = useState("")

const {
  data: followUpData,
  isLoading: followUpLoading,
  isError: followUpError,
  refetch: refetchFollowUp,
} = useQuery({
  queryKey: qk.vegaPostMeetingFollowup(event.id),
  queryFn: () =>
    fetchPostMeetingFollowUp({
      eventTitle: event.title,
      attendeeEmails: event.attendees,
      description: event.description,
      notes: followUpNotes,
    }),
  enabled: followUpEnabled,
  staleTime: 10 * 60 * 1000,
})

const sendMutation = useMutation({
  mutationFn: sendFollowUpEmail,
  onSuccess: () => {
    toast.success("Follow-up sent")
    setFollowUpEnabled(false)
  },
  onError: () => toast.error("Failed to send follow-up"),
})

// Sync body from fetched data
const prevFollowUpDataRef = React.useRef<typeof followUpData>(undefined)
if (followUpData !== prevFollowUpDataRef.current) {
  prevFollowUpDataRef.current = followUpData
  if (followUpData) setFollowUpBody(followUpData.followUp.body)
}
```

Add the `React` import at the top (EventSidePanel uses JSX but may not import React explicitly — add if not present):
```typescript
import React, { useState } from "react"
```

Now append the post-meeting section at the end of the returned JSX, just before the final `</div>` that closes the component:

```typescript
      {/* Post-meeting follow-up — shown only after the event has ended */}
      {isPastEvent && (
        <div className="flex flex-col gap-2">
          <div
            className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            After the meeting
          </div>

          {!followUpEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              style={{ border: "2px solid #111", justifyContent: "start" }}
              onClick={() => setFollowUpEnabled(true)}
            >
              <Send className="size-3.5" />
              Generate Follow-up Email
            </Button>
          )}

          {followUpEnabled && followUpLoading && (
            <div
              className="flex flex-col gap-2 rounded-lg p-3"
              style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
            >
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )}

          {followUpEnabled && followUpError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-destructive flex-1">Failed to generate follow-up.</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2 shrink-0"
                onClick={() => refetchFollowUp()}
              >
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </div>
          )}

          {followUpEnabled && followUpData && (
            <div
              className="flex flex-col gap-3 rounded-lg p-3"
              style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
            >
              {followUpData.actionItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Action Items
                  </p>
                  {followUpData.actionItems.map((item, i) => (
                    <div key={i} className="text-xs text-foreground pl-2">
                      · {item}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Email Draft
                </p>
                <textarea
                  value={followUpBody}
                  onChange={(e) => setFollowUpBody(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 100,
                    padding: "6px 8px",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background: "#fff",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <Button
                size="sm"
                onClick={() =>
                  sendMutation.mutate({
                    to: followUpData.followUp.to,
                    subject: followUpData.followUp.subject,
                    body: followUpBody,
                  })
                }
                disabled={sendMutation.isPending}
                style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
              >
                <Send className="size-3.5" />
                {sendMutation.isPending ? "Sending…" : "Send Follow-up"}
              </Button>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep -i "EventSidePanel\|vega-calendar\|query-keys" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/lib/query-keys.ts \
        apps/main/src/lib/api/vega-calendar.ts \
        apps/main/src/components/vega/EventSidePanel.tsx
git commit -m "feat(vega): add post-meeting follow-up generation and send to EventSidePanel"
```

---

## Task 7: Google Calendar update utility

**Files:**
- Modify: `apps/server/src/common/utils/googleApis.ts`

- [ ] **Step 1: Add `UpdateCalendarEventArgs` interface and `updateCalendarEvent` function at the end of `apps/server/src/common/utils/googleApis.ts`**

```typescript
interface UpdateCalendarEventArgs {
  accessToken: string;
  eventId: string;
  start: string;
  end: string;
}

export const updateCalendarEvent = async (args: UpdateCalendarEventArgs) => {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${args.eventId}`
  );
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: args.start },
      end: { dateTime: args.end },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar event update failed (${res.status}): ${err}`);
  }
  return (await res.json()) as { id: string; htmlLink?: string };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/common/utils/googleApis.ts
git commit -m "feat(vega): add updateCalendarEvent PATCH utility for Google Calendar"
```

---

## Task 8: Auto-reschedule AI endpoint

**Files:**
- Modify: `apps/ai/agents/vega/routes.py`

- [ ] **Step 1: Add `RescheduleDraftRequest` and `RescheduleDraftResponse` models after `PostMeetingFollowUpResponse`**

```python
class RescheduleDraftRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    event_title: str
    attendee_emails: list[str] = []
    original_start: str
    new_start: str
    new_end: str
    metadata: dict = {}


class RescheduleDraftResponse(BaseModel):
    email: dict
    tokens_used: int = 0
    model_used: str = ""
```

- [ ] **Step 2: Add the `POST /ai/vega/reschedule-draft` route at the end of the file**

```python
@router.post("/reschedule-draft", response_model=RescheduleDraftResponse, summary="Draft rescheduling email")
async def reschedule_draft(request: RescheduleDraftRequest) -> RescheduleDraftResponse:
    """Draft a polite rescheduling email when a calendar event is moved."""
    attendee_str = ", ".join(request.attendee_emails[:3]) or "attendees"
    if settings.MOCK_MODE:
        return RescheduleDraftResponse(
            email={
                "to": request.attendee_emails[0] if request.attendee_emails else "",
                "subject": f"Re: {request.event_title} — New time",
                "body": (
                    f"Hi {attendee_str},\n\n"
                    f"I hope this message finds you well. I need to reschedule our upcoming "
                    f"{request.event_title} meeting.\n\n"
                    f"I'd like to propose moving it to {request.new_start}. "
                    f"Please let me know if this new time works for you.\n\n"
                    f"Apologies for any inconvenience, and thanks for your flexibility.\n\nBest,"
                ),
            }
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    raw = await _llm.complete(
        provider=_agent.default_provider,
        model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Draft a short, professional rescheduling email for:\n"
            f"Meeting: {request.event_title}\n"
            f"Attendees: {', '.join(request.attendee_emails)}\n"
            f"Original time: {request.original_start}\n"
            f"New proposed time: {request.new_start} to {request.new_end}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "to (first attendee email), subject (string), body (string — brief, warm, professional)"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
    except Exception:
        data = {
            "to": request.attendee_emails[0] if request.attendee_emails else "",
            "subject": f"Re: {request.event_title} — New time",
            "body": raw[:500],
        }
    return RescheduleDraftResponse(
        email=data,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )
```

- [ ] **Step 3: Verify Python syntax**

```bash
cd apps/ai && python -c "from agents.vega.routes import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/ai/agents/vega/routes.py
git commit -m "feat(vega/ai): add reschedule-draft endpoint with mock + real LLM path"
```

---

## Task 9: Auto-reschedule Express layer

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.schema.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.service.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.controller.ts`
- Modify: `apps/server/src/modules/agents/vega/vega.routes.ts`

- [ ] **Step 1: Add 2 new schemas to the end of `vega.workspace.schema.ts`**

```typescript
export const updateCalendarEventSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const rescheduleDraftSchema = z.object({
  eventTitle: z.string().min(1).max(500),
  attendeeEmails: z.array(z.string().email()).optional().default([]),
  originalStart: z.string().datetime(),
  newStart: z.string().datetime(),
  newEnd: z.string().datetime(),
});
```

- [ ] **Step 2: Add 2 new service functions to the end of `vega.workspace.service.ts`**

First add the new schema imports and the `updateCalendarEvent` import from googleApis. Update the existing googleApis import:

```typescript
import {
  sendGmailReply,
  createCalendarEvent as createGoogleCalendarEvent,
  updateCalendarEvent as updateGoogleCalendarEvent,
} from "../../../common/utils/googleApis.js";
```

Add the new schema types to the schema import:
```typescript
import type {
  // ... existing ...
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
  updateCalendarEventSchema,
  rescheduleDraftSchema,
} from "./vega.workspace.schema.js";
```

Then append at the end of `vega.workspace.service.ts`:

```typescript
// ─── Auto-reschedule ──────────────────────────────────────────────────────────

export const updateCalendarEventWorkspace = async (
  userId: string,
  _organizationId: string,
  eventId: string,
  input: z.infer<typeof updateCalendarEventSchema>
): Promise<{ id: string }> => {
  const token = await requireGoogleToken(userId);
  const result = await updateGoogleCalendarEvent({
    accessToken: token,
    eventId,
    start: input.start,
    end: input.end,
  });
  return { id: result.id };
};

export interface RescheduleDraft {
  email: { to: string; subject: string; body: string };
}

export const getRescheduleDraft = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof rescheduleDraftSchema>
): Promise<RescheduleDraft> => {
  let token = "";
  try {
    token = await requireGoogleToken(userId);
  } catch {
    // token is optional
  }
  const { data } = await aiService.post<{ email: Record<string, unknown> }>(
    "/ai/vega/reschedule-draft",
    {
      user_id: userId,
      organization_id: organizationId,
      event_title: input.eventTitle,
      attendee_emails: input.attendeeEmails,
      original_start: input.originalStart,
      new_start: input.newStart,
      new_end: input.newEnd,
      metadata: { google_access_token: token },
    }
  );
  const em = data.email ?? {};
  return {
    email: {
      to: String(em.to ?? ""),
      subject: String(em.subject ?? ""),
      body: String(em.body ?? ""),
    },
  };
};
```

- [ ] **Step 3: Add 2 new handlers to the end of `vega.workspace.controller.ts`**

Add to schema imports:
```typescript
import {
  // ... existing ...
  postMeetingFollowUpSchema,
  sendFollowUpEmailSchema,
  updateCalendarEventSchema,
  rescheduleDraftSchema,
} from "./vega.workspace.schema.js";
```

Append at end of controller:

```typescript
// Auto-reschedule
export const updateCalendarEventHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const eventId = req.params.eventId as string;
  if (!eventId) throw new BadRequestError("eventId param required");
  const input = updateCalendarEventSchema.parse(req.body);
  const result = await ws.updateCalendarEventWorkspace(userId, organizationId, eventId, input);
  res.status(StatusCodes.OK).json(result);
};

export const getRescheduleDraftHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = rescheduleDraftSchema.parse(req.body);
  const result = await ws.getRescheduleDraft(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
```

- [ ] **Step 4: Add 2 new routes to `vega.routes.ts`**

Add handler imports:
```typescript
import {
  // ... existing ...
  postMeetingFollowUpHandler,
  sendFollowUpEmailHandler,
  updateCalendarEventHandler,
  getRescheduleDraftHandler,
} from "./vega.workspace.controller.js";
```

Add routes:
```typescript
// workspace: reschedule
router.patch("/calendar/events/:eventId", updateCalendarEventHandler);
router.post("/calendar/reschedule-draft", getRescheduleDraftHandler);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.schema.ts \
        apps/server/src/modules/agents/vega/vega.workspace.service.ts \
        apps/server/src/modules/agents/vega/vega.workspace.controller.ts \
        apps/server/src/modules/agents/vega/vega.routes.ts
git commit -m "feat(vega): add auto-reschedule Express endpoints (PATCH events/:eventId, POST reschedule-draft)"
```

---

## Task 10: EventSidePanel reschedule UI

**Files:**
- Modify: `apps/main/src/lib/query-keys.ts`
- Modify: `apps/main/src/lib/api/vega-calendar.ts`
- Modify: `apps/main/src/components/vega/EventSidePanel.tsx`

- [ ] **Step 1: Add `vegaRescheduleDraft` to query keys**

In `apps/main/src/lib/query-keys.ts`, add inside `qk` after `vegaPostMeetingFollowup`:

```typescript
vegaRescheduleDraft: (eventId: string) =>
  ["vega", "reschedule-draft", eventId] as const,
```

- [ ] **Step 2: Add 2 new functions to `apps/main/src/lib/api/vega-calendar.ts`**

Append at the end of the file:

```typescript
export interface RescheduleDraft {
  email: { to: string; subject: string; body: string }
}

export function fetchRescheduleDraft(payload: {
  eventTitle: string
  attendeeEmails: string[]
  originalStart: string
  newStart: string
  newEnd: string
}): Promise<RescheduleDraft> {
  return apiFetch<RescheduleDraft>("/agents/vega/calendar/reschedule-draft", {
    method: "POST",
    body: payload,
  })
}

export function patchCalendarEvent(
  eventId: string,
  payload: { start: string; end: string }
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/agents/vega/calendar/events/${eventId}`, {
    method: "PATCH",
    body: payload,
  })
}
```

- [ ] **Step 3: Add reschedule UI to `EventSidePanel.tsx`**

Add `vegaRescheduleDraft` to the qk imports (already using `qk`), and add the new API function imports:

```typescript
import {
  fetchMeetingPrep,
  fetchPostMeetingFollowUp,
  sendFollowUpEmail,
  fetchRescheduleDraft,
  patchCalendarEvent,
} from "@/lib/api/vega-calendar"
```

Add `CalendarClock` to the lucide import (current: `X, Video, Users, Sparkles, Send, RotateCcw`):
```typescript
import { X, Video, Users, Sparkles, Send, RotateCcw, CalendarClock } from "lucide-react"
```

Inside the `EventSidePanel` component body, add after the existing follow-up state variables:

```typescript
const [showReschedule, setShowReschedule] = useState(false)
const [rescheduleDate, setRescheduleDate] = useState(
  new Date(event.start).toISOString().slice(0, 10)
)
const [rescheduleStartTime, setRescheduleStartTime] = useState(
  new Date(event.start).toTimeString().slice(0, 5)
)
const [rescheduleEndTime, setRescheduleEndTime] = useState(
  new Date(event.end).toTimeString().slice(0, 5)
)
const [rescheduleEmailBody, setRescheduleEmailBody] = useState("")
const [rescheduleDraftEnabled, setRescheduleDraftEnabled] = useState(false)
const [rescheduling, setRescheduling] = useState(false)

const newStart = showReschedule
  ? new Date(`${rescheduleDate}T${rescheduleStartTime}:00`).toISOString()
  : ""
const newEnd = showReschedule
  ? new Date(`${rescheduleDate}T${rescheduleEndTime}:00`).toISOString()
  : ""

const {
  data: rescheduleData,
  isLoading: rescheduleLoading,
  isError: rescheduleError,
  refetch: refetchRescheduleDraft,
} = useQuery({
  queryKey: qk.vegaRescheduleDraft(event.id),
  queryFn: () =>
    fetchRescheduleDraft({
      eventTitle: event.title,
      attendeeEmails: event.attendees,
      originalStart: event.start,
      newStart,
      newEnd,
    }),
  enabled: rescheduleDraftEnabled,
  staleTime: 5 * 60 * 1000,
})

const prevRescheduleDataRef = React.useRef<typeof rescheduleData>(undefined)
if (rescheduleData !== prevRescheduleDataRef.current) {
  prevRescheduleDataRef.current = rescheduleData
  if (rescheduleData) setRescheduleEmailBody(rescheduleData.email.body)
}

const handleConfirmReschedule = async () => {
  if (rescheduleEndTime <= rescheduleStartTime) {
    toast.error("End time must be after start time")
    return
  }
  setRescheduling(true)
  try {
    await patchCalendarEvent(event.id, { start: newStart, end: newEnd })
    if (rescheduleData) {
      await sendFollowUpEmail({
        to: rescheduleData.email.to,
        subject: rescheduleData.email.subject,
        body: rescheduleEmailBody,
      })
      toast.success("Event rescheduled and email sent")
    } else {
      toast.success("Event rescheduled")
    }
    setShowReschedule(false)
    setRescheduleDraftEnabled(false)
  } catch {
    toast.error("Failed to reschedule event")
  } finally {
    setRescheduling(false)
  }
}
```

Append the reschedule UI section in the JSX, after the post-meeting section (before the final closing `</div>`):

```typescript
      {/* Reschedule section */}
      <div className="flex flex-col gap-2">
        {!showReschedule ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            style={{ border: "2px solid #111", justifyContent: "start" }}
            onClick={() => setShowReschedule(true)}
          >
            <CalendarClock className="size-3.5" />
            Reschedule
          </Button>
        ) : (
          <div
            className="flex flex-col gap-3 rounded-lg p-3"
            style={{ border: "1.5px solid #111", background: "#fff" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                New time
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => {
                  setShowReschedule(false)
                  setRescheduleDraftEnabled(false)
                }}
              >
                Cancel
              </Button>
            </div>

            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => {
                setRescheduleDate(e.target.value)
                setRescheduleDraftEnabled(false)
              }}
              style={{
                width: "100%",
                padding: "5px 8px",
                border: "1.5px solid #111",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                background: "#fff",
                outline: "none",
              }}
            />

            <div className="flex gap-2">
              {(["Start", "End"] as const).map((label) => (
                <div key={label} className="flex flex-col gap-0.5 flex-1">
                  <span
                    className="text-[9px] uppercase tracking-wider text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {label}
                  </span>
                  <input
                    type="time"
                    value={label === "Start" ? rescheduleStartTime : rescheduleEndTime}
                    onChange={(e) => {
                      if (label === "Start") setRescheduleStartTime(e.target.value)
                      else setRescheduleEndTime(e.target.value)
                      setRescheduleDraftEnabled(false)
                    }}
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      border: "1.5px solid #111",
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      background: "#fff",
                      outline: "none",
                    }}
                  />
                </div>
              ))}
            </div>

            {!rescheduleDraftEnabled && (
              <Button
                variant="outline"
                size="sm"
                style={{ border: "2px solid #111", justifyContent: "start" }}
                onClick={() => setRescheduleDraftEnabled(true)}
              >
                <Sparkles className="size-3.5" />
                Draft Rescheduling Email
              </Button>
            )}

            {rescheduleDraftEnabled && rescheduleLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            )}

            {rescheduleDraftEnabled && rescheduleError && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-destructive flex-1">Failed to generate email.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2 shrink-0"
                  onClick={() => refetchRescheduleDraft()}
                >
                  Retry
                </Button>
              </div>
            )}

            {rescheduleDraftEnabled && rescheduleData && (
              <textarea
                value={rescheduleEmailBody}
                onChange={(e) => setRescheduleEmailBody(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 90,
                  padding: "6px 8px",
                  border: "1.5px solid #111",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  background: "#fff",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            )}

            <Button
              size="sm"
              onClick={handleConfirmReschedule}
              disabled={rescheduling}
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <CalendarClock className="size-3.5" />
              {rescheduling
                ? "Rescheduling…"
                : rescheduleData
                ? "Confirm & Send"
                : "Confirm Reschedule"}
            </Button>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep -i "EventSidePanel\|vega-calendar\|query-keys" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/lib/query-keys.ts \
        apps/main/src/lib/api/vega-calendar.ts \
        apps/main/src/components/vega/EventSidePanel.tsx
git commit -m "feat(vega): add reschedule UI to EventSidePanel with new time picker, email draft, and confirm flow"
```

---

## Verification Checklist

After all 10 tasks are complete:

1. **TypeScript clean:** `cd apps/server && npx tsc --noEmit` — no new errors. Same for `apps/main`.
2. **Python syntax:** `cd apps/ai && python -c "from agents.vega.routes import router; print('OK')"` — prints OK.
3. **Cron smoke test:** Start server in development, temporarily call `startVegaCron()` outside the `NODE_ENV === "production"` guard, verify the log line `[vega-cron] Scheduled: ...` appears on startup.
4. **Briefing tabs:** Open `/workspace/briefing` — three tabs (Morning / Evening / Weekly) appear. Clicking each tab fetches and displays the correct briefing type.
5. **VIP contacts:** Navigate to `/settings/vega` — page loads, shows empty state. Add a contact via the form → appears in list. Remove it → disappears.
6. **Post-meeting follow-up:** In the calendar, click a past event (end time < now) — "After the meeting" section appears with "Generate Follow-up Email" button. Click it → loading skeleton → draft email + action items appear. Edit the draft → click "Send Follow-up" → toast "Follow-up sent".
7. **Reschedule:** Click any event → "Reschedule" button is visible. Click it → date/time pickers appear. Change the date/time → click "Draft Rescheduling Email" → email draft loads. Edit → "Confirm & Send" → event updated in Google Calendar + rescheduling email sent.
8. **Follow-up overdue check:** Insert a `VegaFollowUp` record via Prisma Studio with `dueAt` in the past and `status = PENDING`. Run `runFollowUpCheck()` directly — verify status updates to `OVERDUE`.
