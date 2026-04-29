# Vega Workspace Phase 2 — Calendar & Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/workspace/calendar` page with week-view, event side panel (AI prep brief), event creation form, and an Email→Meeting shortcut from the inbox panel.

**Architecture:** New workspace-style Express endpoints (`GET/POST /agents/vega/calendar/events`, `POST /agents/vega/calendar/prep`) call the existing FastAPI AI service (calendar-summary + new meeting-prep endpoint). The frontend CalendarView renders a 7-day grid; clicking an event opens EventSidePanel; clicking "+ New Event" opens EventCreateForm in the right panel. EmailActionPanel gets a "Schedule Meeting" button that navigates to `/workspace/calendar` with prefill query params.

**Tech Stack:** Express 5 + Zod, FastAPI + Pydantic, Next.js 16 App Router, TanStack React Query 5, shadcn/ui (Button, Badge, Skeleton), Lucide icons, Sonner toasts.

---

## Codebase conventions (read before writing any code)

- Express params typed as `string | string[]` — always cast to `string` explicitly.
- `requireGoogleToken(userId)` — already defined in `vega.workspace.service.ts:27`.
- `aiService.post<T>(path, body)` — imported from `"../../../common/utils/aiService.js"`.
- No Prisma relations for application models — plain `organizationId String` FK, matching pattern in existing VegaFollowUp / VIPContact.
- Frontend API calls use `apiFetch<T>(path, opts)` from `"@/lib/api/client"` — body is JSON-stringified automatically.
- `authClient.useActiveOrganization()` from `"@/lib/auth-client"` — gives `activeOrg.id`.
- Check `node_modules/next/dist/docs/` for any App Router API questions.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/server/src/modules/agents/vega/vega.workspace.schema.ts` | Modify | Add 3 calendar Zod schemas |
| `apps/ai/agents/vega/routes.py` | Modify | Add `POST /ai/vega/meeting-prep` endpoint |
| `apps/server/src/modules/agents/vega/vega.workspace.service.ts` | Modify | Add 3 calendar service functions |
| `apps/server/src/modules/agents/vega/vega.workspace.controller.ts` | Modify | Add 3 calendar handler functions |
| `apps/server/src/modules/agents/vega/vega.routes.ts` | Modify | Wire 3 calendar routes |
| `apps/main/src/lib/api/vega-calendar.ts` | Create | Frontend API functions + types |
| `apps/main/src/lib/query-keys.ts` | Modify | Add `vegaCalendar` + `vegaMeetingPrep` keys |
| `apps/main/src/components/vega/CalendarView.tsx` | Create | Week-view grid with day columns + event cards |
| `apps/main/src/components/vega/EventSidePanel.tsx` | Create | Event detail + on-demand AI prep brief |
| `apps/main/src/components/vega/EventCreateForm.tsx` | Create | Create event form (title, date/time, attendees, Meet toggle) |
| `apps/main/src/app/(dashboard)/workspace/calendar/page.tsx` | Create | Calendar page shell, passes prefill searchParams to CalendarView |
| `apps/main/src/components/layout/AppSidebar.tsx` | Modify | Add Calendar nav item |
| `apps/main/src/components/vega/EmailActionPanel.tsx` | Modify | Add "Schedule Meeting" button for emails with meeting_request |

---

## Task 1: Calendar Zod schemas

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.schema.ts`

- [ ] **Step 1: Append the 3 new schemas to the end of the file**

```typescript
export const getCalendarSchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(30).optional().default(7),
});

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  start: z.string().datetime(),
  end: z.string().datetime(),
  attendees: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
  addGoogleMeet: z.boolean().optional().default(true),
});

export const getMeetingPrepSchema = z.object({
  eventTitle: z.string().min(1).max(500),
  attendeeEmails: z.array(z.string().email()).optional().default([]),
  description: z.string().max(2000).optional().default(""),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.schema.ts
git commit -m "feat(vega): add calendar Zod schemas (getCalendar, createCalendarEvent, getMeetingPrep)"
```

---

## Task 2: AI meeting-prep endpoint

**Files:**
- Modify: `apps/ai/agents/vega/routes.py`

- [ ] **Step 1: Add the MeetingPrepRequest and MeetingPrepResponse models after the ComposeEmailResponse class (around line 221)**

```python
class MeetingPrepRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    event_title: str
    attendee_emails: list[str] = []
    description: str = ""
    metadata: dict = {}


class MeetingPrepResponse(BaseModel):
    prep: dict
    tokens_used: int = 0
    model_used: str = ""
```

- [ ] **Step 2: Add the route at the end of the file (before the compose-email route, or after it — after is fine)**

```python
@router.post("/meeting-prep", response_model=MeetingPrepResponse, summary="Pre-meeting brief")
async def meeting_prep(request: MeetingPrepRequest) -> MeetingPrepResponse:
    """Generate an AI pre-meeting brief using calendar context and email history with attendees."""
    if settings.MOCK_MODE:
        attendee_str = ", ".join(request.attendee_emails[:2]) or "no external attendees"
        return MeetingPrepResponse(prep={
            "summary": f"Meeting: {request.event_title}. Attendees include {attendee_str}.",
            "key_points": [
                "Review recent email threads with attendees before joining",
                "Prepare questions about their current workflow and pain points",
                "Have the product demo or metrics deck ready to share",
            ],
            "attendee_context": (
                "Based on recent emails: this attendee has shown strong interest. "
                "They are decision-makers at their organization with budget authority."
            ),
            "suggested_agenda": [
                "Introductions and quick context (5 min)",
                "Current situation and challenges (10 min)",
                "Product walkthrough / proposal (15 min)",
                "Q&A and next steps (10 min)",
            ],
        })

    token = request.metadata.get("google_access_token", "")
    emails = []
    if token and request.attendee_emails:
        try:
            all_emails = await list_unread(token, max_results=20)
            emails = [
                e for e in all_emails
                if any(
                    a.lower() in (e.get("from", "") + e.get("to", "")).lower()
                    for a in request.attendee_emails
                )
            ]
        except Exception:
            pass

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    context = (
        f"Event: {request.event_title}\n"
        f"Attendees: {', '.join(request.attendee_emails)}\n"
        f"Description: {request.description}"
    )
    if emails:
        context += f"\n\nRecent emails involving these attendees:\n{json.dumps(emails[:3])}"

    raw = await _llm.complete(
        provider=_agent.default_provider,
        model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Generate a pre-meeting brief for this upcoming meeting:\n{context}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "summary (string — 1-2 sentences on meeting context), "
            "key_points (list of strings — things to know or prepare), "
            "attendee_context (string — who they are and relationship history), "
            "suggested_agenda (list of strings — agenda items with time estimates)"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
    except Exception:
        data = {
            "summary": raw[:300],
            "key_points": [],
            "attendee_context": "",
            "suggested_agenda": [],
        }
    return MeetingPrepResponse(prep=data, tokens_used=tokens_used, model_used=_agent.default_model)
```

- [ ] **Step 3: Verify Python syntax**

```bash
cd apps/ai && python -c "from agents.vega.routes import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/ai/agents/vega/routes.py
git commit -m "feat(vega/ai): add meeting-prep endpoint with mock + real LLM path"
```

---

## Task 3: Calendar workspace service functions

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.service.ts`

- [ ] **Step 1: Add the import for `createCalendarEvent` from googleApis at the top of the file (after the existing imports)**

The current import block ends around line 18. Add this import:

```typescript
import { sendGmailReply, createCalendarEvent as createGoogleCalendarEvent } from "../../../common/utils/googleApis.js";
```

Replace the existing `sendGmailReply` import line (which currently only imports `sendGmailReply`) with the above.

- [ ] **Step 2: Add the calendar types and three service functions at the end of the file (before the last closing brace if any, or simply appended)**

```typescript
// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  meetLink?: string;
  status: string;
  recurring?: boolean;
}

export interface CalendarSlot {
  date: string;
  start: string;
  end: string;
  durationHours: number;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  slots: CalendarSlot[];
}

export interface MeetingPrepResult {
  summary: string;
  keyPoints: string[];
  attendeeContext: string;
  suggestedAgenda: string[];
}

export const getCalendar = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getCalendarSchema>
): Promise<CalendarResponse> => {
  const token = await requireGoogleToken(userId);
  const { data } = await aiService.post<{
    events: Array<Record<string, unknown>>;
    free_slots: Array<Record<string, unknown>>;
  }>("/ai/vega/calendar-summary", {
    user_id: userId,
    organization_id: organizationId,
    days_ahead: input.daysAhead,
    metadata: { google_access_token: token },
  });

  const events: CalendarEvent[] = (data.events ?? []).map((e) => ({
    id: String(e.id ?? ""),
    title: String(e.title ?? ""),
    description: String(e.description ?? ""),
    start: String(e.start ?? ""),
    end: String(e.end ?? ""),
    attendees: Array.isArray(e.attendees) ? e.attendees.map(String) : [],
    location: String(e.location ?? ""),
    meetLink: e.meet_link ? String(e.meet_link) : undefined,
    status: String(e.status ?? ""),
    recurring: Boolean(e.recurring),
  }));

  const slots: CalendarSlot[] = (data.free_slots ?? []).map((s) => ({
    date: String(s.date ?? ""),
    start: String(s.start ?? ""),
    end: String(s.end ?? ""),
    durationHours: Number(s.duration_hours ?? 0),
  }));

  return { events, slots };
};

export const createCalendarEventWorkspace = async (
  userId: string,
  _organizationId: string,
  input: z.infer<typeof createCalendarEventSchema>
): Promise<CalendarEvent> => {
  const token = await requireGoogleToken(userId);
  const result = await createGoogleCalendarEvent({
    accessToken: token,
    title: input.title,
    start: input.start,
    end: input.end,
    attendees: input.attendees,
    description: input.description,
    addGoogleMeet: input.addGoogleMeet,
  });

  const meetLink =
    result.hangoutLink ??
    result.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri;

  return {
    id: result.id,
    title: input.title,
    description: input.description ?? "",
    start: input.start,
    end: input.end,
    attendees: input.attendees ?? [],
    location: meetLink ? "Google Meet" : "",
    meetLink,
    status: "confirmed",
  };
};

export const getMeetingPrepWorkspace = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getMeetingPrepSchema>
): Promise<MeetingPrepResult> => {
  const token = await requireGoogleToken(userId);
  const { data } = await aiService.post<{ prep: Record<string, unknown> }>(
    "/ai/vega/meeting-prep",
    {
      user_id: userId,
      organization_id: organizationId,
      event_title: input.eventTitle,
      attendee_emails: input.attendeeEmails,
      description: input.description,
      metadata: { google_access_token: token },
    }
  );

  const prep = data.prep ?? {};
  return {
    summary: String(prep.summary ?? ""),
    keyPoints: Array.isArray(prep.key_points) ? prep.key_points.map(String) : [],
    attendeeContext: String(prep.attendee_context ?? ""),
    suggestedAgenda: Array.isArray(prep.suggested_agenda)
      ? prep.suggested_agenda.map(String)
      : [],
  };
};
```

- [ ] **Step 3: Add the new schema imports to the existing import block at the top of the file**

The file currently imports from `./vega.workspace.schema.js`:
```typescript
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
```

Add the three new schemas to that import:
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors related to vega.workspace.service.ts.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.service.ts
git commit -m "feat(vega): add calendar service functions (getCalendar, createCalendarEventWorkspace, getMeetingPrepWorkspace)"
```

---

## Task 4: Calendar workspace controller handlers

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.workspace.controller.ts`

- [ ] **Step 1: Add the 3 new imports at the top of the file**

The file currently imports from `./vega.workspace.service.js`. Extend that import:

```typescript
import * as ws from "./vega.workspace.service.js";
```

(It already uses `* as ws` — that means all three new functions are already accessible as `ws.getCalendar`, `ws.createCalendarEventWorkspace`, `ws.getMeetingPrepWorkspace`.)

Now add the three new schema imports. The file currently imports:
```typescript
import {
  getInboxSchema,
  sendReplySchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
```

Extend it:
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

- [ ] **Step 2: Append the 3 new handler functions at the end of the file**

```typescript
// Calendar
export const getCalendarEvents = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getCalendarSchema.parse(req.query);
  const result = await ws.getCalendar(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const createCalendarEventHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = createCalendarEventSchema.parse(req.body);
  const result = await ws.createCalendarEventWorkspace(userId, organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const getMeetingPrepHandler = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getMeetingPrepSchema.parse(req.body);
  const result = await ws.getMeetingPrepWorkspace(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.controller.ts
git commit -m "feat(vega): add calendar controller handlers (getCalendarEvents, createCalendarEventHandler, getMeetingPrepHandler)"
```

---

## Task 5: Wire calendar routes

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.routes.ts`

- [ ] **Step 1: Add the 3 new handler imports to the existing workspace controller import block**

The file currently has:
```typescript
import {
  getInbox,
  sendReply,
  getFollowUps,
  createFollowUp,
  cancelFollowUp,
  getVIPContacts,
  addVIPContact,
  removeVIPContact,
  getBriefing,
  generateBriefing,
} from "./vega.workspace.controller.js";
```

Replace with:
```typescript
import {
  getInbox,
  sendReply,
  getFollowUps,
  createFollowUp,
  cancelFollowUp,
  getVIPContacts,
  addVIPContact,
  removeVIPContact,
  getBriefing,
  generateBriefing,
  getCalendarEvents,
  createCalendarEventHandler,
  getMeetingPrepHandler,
} from "./vega.workspace.controller.js";
```

- [ ] **Step 2: Add the 3 new routes after the briefing routes**

```typescript
// workspace: calendar
router.get("/calendar/events", getCalendarEvents);
router.post("/calendar/events", createCalendarEventHandler);
router.post("/calendar/prep", getMeetingPrepHandler);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.routes.ts
git commit -m "feat(vega): wire calendar workspace routes (GET/POST /calendar/events, POST /calendar/prep)"
```

---

## Task 6: Frontend API client + query keys

**Files:**
- Create: `apps/main/src/lib/api/vega-calendar.ts`
- Modify: `apps/main/src/lib/query-keys.ts`

- [ ] **Step 1: Create `apps/main/src/lib/api/vega-calendar.ts`**

```typescript
import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  meetLink?: string;
  status: string;
  recurring?: boolean;
}

export interface CalendarSlot {
  date: string;
  start: string;
  end: string;
  durationHours: number;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  slots: CalendarSlot[];
}

export interface MeetingPrepResponse {
  summary: string;
  keyPoints: string[];
  attendeeContext: string;
  suggestedAgenda: string[];
}

export interface CreateEventPayload {
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  addGoogleMeet?: boolean;
}

export function fetchCalendar(daysAhead = 14): Promise<CalendarResponse> {
  return apiFetch<CalendarResponse>(
    `/agents/vega/calendar/events?daysAhead=${daysAhead}`
  );
}

export function fetchMeetingPrep(payload: {
  eventTitle: string;
  attendeeEmails: string[];
  description: string;
}): Promise<MeetingPrepResponse> {
  return apiFetch<MeetingPrepResponse>("/agents/vega/calendar/prep", {
    method: "POST",
    body: payload,
  });
}

export function createCalendarEvent(
  payload: CreateEventPayload
): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>("/agents/vega/calendar/events", {
    method: "POST",
    body: payload,
  });
}
```

- [ ] **Step 2: Add 2 new query keys to `apps/main/src/lib/query-keys.ts`**

Add these two entries inside the `qk` object, after the `vegaBriefing` entry:

```typescript
vegaCalendar: (organizationId: string) =>
  ["vega", "calendar", organizationId] as const,
vegaMeetingPrep: (eventId: string) =>
  ["vega", "meeting-prep", eventId] as const,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/main/src/lib/api/vega-calendar.ts apps/main/src/lib/query-keys.ts
git commit -m "feat(vega): add calendar frontend API client and query keys"
```

---

## Task 7: CalendarView component

**Files:**
- Create: `apps/main/src/components/vega/CalendarView.tsx`

- [ ] **Step 1: Create the file with the full component**

```typescript
"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import { fetchCalendar } from "@/lib/api/vega-calendar"
import { EventSidePanel } from "./EventSidePanel"
import { EventCreateForm } from "./EventCreateForm"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Video,
  RotateCcw,
  CalendarDays,
} from "lucide-react"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Event card within a day column ──────────────────────────────────────────

function EventCell({
  event,
  isSelected,
  onSelect,
}: {
  event: CalendarEvent
  isSelected: boolean
  onSelect: (e: CalendarEvent) => void
}) {
  return (
    <button
      onClick={() => onSelect(event)}
      className="w-full text-left"
      style={{
        padding: "5px 8px",
        border: isSelected ? "2px solid #111" : "1.5px solid #E5E5E5",
        borderRadius: 6,
        background: isSelected ? "#FFF9ED" : "#fff",
        boxShadow: isSelected ? "2px 2px 0 #111" : "none",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">{event.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {fmtTime(event.start)}
          </p>
        </div>
        {event.meetLink && <Video className="size-3 text-green-600 shrink-0 mt-0.5" />}
      </div>
      {event.attendees.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {event.attendees.slice(0, 2).join(", ")}
          {event.attendees.length > 2 && ` +${event.attendees.length - 2}`}
        </p>
      )}
    </button>
  )
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  date,
  events,
  selectedId,
  onSelect,
}: {
  date: Date
  events: CalendarEvent[]
  selectedId: string | null
  onSelect: (e: CalendarEvent) => void
}) {
  const isToday = isSameDay(date, new Date())
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div
      className="flex flex-col min-w-0 flex-1"
      style={{ borderRight: "1.5px solid #E5E5E5" }}
    >
      <div
        className="flex flex-col items-center py-2 shrink-0"
        style={{
          borderBottom: "1.5px solid #E5E5E5",
          background: isToday ? "#FFF9ED" : "transparent",
        }}
      >
        <span
          className="text-[9px] uppercase tracking-wider text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </span>
        <span
          className="text-xs font-semibold mt-0.5"
          style={{ color: isToday ? "#111" : "#666" }}
        >
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-1.5 flex-1 overflow-y-auto">
        {sorted.map((ev) => (
          <EventCell
            key={ev.id}
            event={ev}
            isSelected={selectedId === ev.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  initialPrefill?: {
    title?: string
    attendees?: string[]
    description?: string
  }
}

export function CalendarView({ initialPrefill }: CalendarViewProps) {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(!!initialPrefill)
  const [createPrefill, setCreatePrefill] = useState(initialPrefill)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: qk.vegaCalendar(organizationId),
    queryFn: () => fetchCalendar(14),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of data?.events ?? []) {
      const day = ev.start.slice(0, 10)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(ev)
    }
    return map
  }, [data?.events])

  const handleEventCreated = (event: CalendarEvent) => {
    setShowCreateForm(false)
    setCreatePrefill(undefined)
    setSelectedEvent(event)
    queryClient.invalidateQueries({ queryKey: qk.vegaCalendar(organizationId) })
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-full rounded-none" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="size-8 text-destructive opacity-60" />
        <p className="text-sm font-medium">Could not load calendar</p>
        <p className="text-xs text-muted-foreground">
          Check your Google connection in Settings → Integrations
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Calendar grid */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: "2px solid #E5E5E5" }}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span
              className="text-xs font-semibold px-2"
              style={{ fontFamily: "var(--font-mono)", minWidth: 180 }}
            >
              {weekStart.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}{" "}
              –{" "}
              {addDays(weekStart, 6).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2 ml-1"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowCreateForm(true)
                setCreatePrefill(undefined)
                setSelectedEvent(null)
              }}
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <Plus className="size-3.5" />
              New Event
            </Button>
          </div>
        </div>

        {/* Week grid */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {weekDays.map((day) => {
            const key = day.toISOString().slice(0, 10)
            return (
              <DayColumn
                key={key}
                date={day}
                events={eventsByDay.get(key) ?? []}
                selectedId={selectedEvent?.id ?? null}
                onSelect={(ev) => {
                  setSelectedEvent(ev)
                  setShowCreateForm(false)
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div
        className="shrink-0 overflow-y-auto"
        style={{ width: 320, borderLeft: "2px solid #E5E5E5" }}
      >
        {showCreateForm ? (
          <EventCreateForm
            prefill={createPrefill}
            onCreated={handleEventCreated}
            onCancel={() => {
              setShowCreateForm(false)
              setCreatePrefill(undefined)
            }}
          />
        ) : selectedEvent ? (
          <EventSidePanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
            <CalendarDays className="size-10 opacity-20" />
            <p className="text-sm text-center">
              Select an event to see details, or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep "CalendarView" | head -10
```

Expected: no errors referencing CalendarView.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/components/vega/CalendarView.tsx
git commit -m "feat(vega): add CalendarView week-grid component with day columns and event cards"
```

---

## Task 8: EventSidePanel component

**Files:**
- Create: `apps/main/src/components/vega/EventSidePanel.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { fetchMeetingPrep } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { X, Video, Users, Sparkles } from "lucide-react"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  )
}

function durationLabel(start: string, end: string): string {
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  )
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function EventSidePanel({
  event,
  onClose,
}: {
  event: CalendarEvent
  onClose: () => void
}) {
  const [prepEnabled, setPrepEnabled] = useState(false)

  const { data: prep, isLoading: prepLoading, isError: prepError } = useQuery({
    queryKey: qk.vegaMeetingPrep(event.id),
    queryFn: () =>
      fetchMeetingPrep({
        eventTitle: event.title,
        attendeeEmails: event.attendees,
        description: event.description,
      }),
    enabled: prepEnabled,
    staleTime: 10 * 60 * 1000,
  })

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{fmtDateTime(event.start)}</p>
          <p className="text-xs text-muted-foreground">
            {durationLabel(event.start, event.end)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {event.meetLink && (
          <Badge
            style={{
              background: "#EEF9F6",
              color: "#1DBC87",
              border: "1px solid #1DBC87",
            }}
          >
            <Video className="size-3 mr-1" />
            Google Meet
          </Badge>
        )}
        {event.recurring && <Badge variant="outline">Recurring</Badge>}
      </div>

      {/* Attendees */}
      {event.attendees.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Attendees ({event.attendees.length})
          </div>
          {event.attendees.map((email) => (
            <div
              key={email}
              className="text-xs text-foreground pl-5 truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {email}
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Description</p>
          <p className="text-xs text-foreground leading-relaxed">{event.description}</p>
        </div>
      )}

      {/* Join link */}
      {event.meetLink && (
        <a
          href={event.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-green-600 hover:underline"
        >
          <Video className="size-3.5" />
          Join Google Meet
        </a>
      )}

      {/* Prep Brief */}
      <div className="flex flex-col gap-2">
        {!prepEnabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            style={{ border: "2px solid #111", justifyContent: "start" }}
            onClick={() => setPrepEnabled(true)}
          >
            <Sparkles className="size-3.5" />
            Generate Prep Brief
          </Button>
        )}

        {prepEnabled && prepLoading && (
          <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}

        {prepEnabled && prepError && (
          <p className="text-xs text-destructive">Failed to generate prep brief. Try again.</p>
        )}

        {prepEnabled && prep && (
          <div
            className="flex flex-col gap-3 rounded-lg p-3"
            style={{ background: "#FFF9ED", border: "1.5px solid #E5E5E5" }}
          >
            <p className="text-xs leading-relaxed text-foreground">{prep.summary}</p>

            {prep.keyPoints.length > 0 && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Key Points
                </p>
                {prep.keyPoints.map((pt, i) => (
                  <div key={i} className="text-xs text-foreground pl-2">
                    · {pt}
                  </div>
                ))}
              </div>
            )}

            {prep.suggestedAgenda.length > 0 && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Suggested Agenda
                </p>
                {prep.suggestedAgenda.map((item, i) => (
                  <div key={i} className="text-xs text-foreground pl-2">
                    {i + 1}. {item}
                  </div>
                ))}
              </div>
            )}

            {prep.attendeeContext && (
              <div className="flex flex-col gap-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Attendee Context
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {prep.attendeeContext}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep "EventSidePanel" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/components/vega/EventSidePanel.tsx
git commit -m "feat(vega): add EventSidePanel with on-demand AI prep brief"
```

---

## Task 9: EventCreateForm component

**Files:**
- Create: `apps/main/src/components/vega/EventCreateForm.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { createCalendarEvent } from "@/lib/api/vega-calendar"
import { Button } from "@/components/ui/button"
import { X, Plus, Trash2, Video } from "lucide-react"
import { toast } from "sonner"
import type { CalendarEvent } from "@/lib/api/vega-calendar"

interface EventCreateFormProps {
  onCreated: (event: CalendarEvent) => void
  onCancel: () => void
  prefill?: {
    title?: string
    attendees?: string[]
    description?: string
  }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1.5px solid #111",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  color: "#555",
  marginBottom: 4,
  display: "block",
}

export function EventCreateForm({
  onCreated,
  onCancel,
  prefill,
}: EventCreateFormProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().slice(0, 10)

  const [title, setTitle] = useState(prefill?.title ?? "")
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("11:00")
  const [attendeeInput, setAttendeeInput] = useState("")
  const [attendees, setAttendees] = useState<string[]>(prefill?.attendees ?? [])
  const [description, setDescription] = useState(prefill?.description ?? "")
  const [addMeet, setAddMeet] = useState(true)

  const { mutate, isPending } = useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: (event) => {
      toast.success("Event created")
      onCreated(event)
    },
    onError: () => {
      toast.error("Failed to create event")
    },
  })

  const addAttendee = () => {
    const email = attendeeInput.trim()
    if (email && !attendees.includes(email)) {
      setAttendees((prev) => [...prev, email])
      setAttendeeInput("")
    }
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    mutate({
      title: title.trim(),
      start: `${date}T${startTime}:00.000Z`,
      end: `${date}T${endTime}:00.000Z`,
      attendees,
      description,
      addGoogleMeet: addMeet,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold">New Event</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Title</label>
        <input
          style={inputStyle}
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          style={inputStyle}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label style={labelStyle}>Start</label>
          <input
            type="time"
            style={inputStyle}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label style={labelStyle}>End</label>
          <input
            type="time"
            style={inputStyle}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Attendees</label>
        <div className="flex gap-1.5">
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="email@example.com"
            value={attendeeInput}
            onChange={(e) => setAttendeeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addAttendee()
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={addAttendee}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {attendees.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {attendees.map((email) => (
              <div key={email} className="flex items-center justify-between gap-1">
                <span
                  className="text-xs truncate"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {email}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  onClick={() =>
                    setAttendees((prev) => prev.filter((e) => e !== email))
                  }
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          placeholder="Optional notes or agenda"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={addMeet}
          onChange={(e) => setAddMeet(e.target.checked)}
          style={{ accentColor: "#1DBC87" }}
        />
        <Video className="size-3.5 text-green-600" />
        <span className="text-xs" style={{ fontFamily: "var(--font-mono)" }}>
          Add Google Meet
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          size="sm"
          style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111", flex: 1 }}
        >
          {isPending ? "Creating…" : "Create Event"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | grep "EventCreateForm" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/components/vega/EventCreateForm.tsx
git commit -m "feat(vega): add EventCreateForm with attendee management and Google Meet toggle"
```

---

## Task 10: Calendar page, sidebar nav item, and Email→Meeting shortcut

**Files:**
- Create: `apps/main/src/app/(dashboard)/workspace/calendar/page.tsx`
- Modify: `apps/main/src/components/layout/AppSidebar.tsx`
- Modify: `apps/main/src/components/vega/EmailActionPanel.tsx`

- [ ] **Step 1: Create the calendar page directory and file**

```bash
mkdir -p "apps/main/src/app/(dashboard)/workspace/calendar"
```

Create `apps/main/src/app/(dashboard)/workspace/calendar/page.tsx`:

```typescript
import { CalendarView } from "@/components/vega/CalendarView"
import { PageHeader } from "@/components/ui/page-header"

type SearchParams = Promise<{
  title?: string
  attendees?: string
  description?: string
}>

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const prefill =
    sp.title || sp.attendees || sp.description
      ? {
          title: sp.title,
          attendees: sp.attendees ? [sp.attendees] : [],
          description: sp.description,
        }
      : undefined

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 pb-4">
      <PageHeader
        kicker="vega"
        title="smart calendar"
        subtitle="AI-powered scheduling — plan, prep, and follow up on every meeting."
        sticker={{ label: "calendar", rot: -3, color: "var(--vq-green)" }}
      />
      <div
        className="flex-1 min-h-0 overflow-hidden rounded-xl"
        style={{ border: "2.5px solid #111", boxShadow: "4px 4px 0 #111" }}
      >
        <CalendarView initialPrefill={prefill} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Calendar to AppSidebar**

In `apps/main/src/components/layout/AppSidebar.tsx`, add `Calendar` to the lucide import:

```typescript
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  FileText,
  Newspaper,
  Users2,
  Mail,
  Calendar,
  ChevronDown,
  LogOut,
} from "lucide-react"
```

Then add the Calendar item to `workspaceItems` (between Inbox and Content):

```typescript
const workspaceItems = [
  { href: "/workspace/briefing", label: "Briefing", icon: Newspaper },
  { href: "/workspace/inbox", label: "Inbox", icon: Mail },
  { href: "/workspace/calendar", label: "Calendar", icon: Calendar },
  { href: "/workspace/content", label: "Content", icon: FileText },
  { href: "/workspace/leads", label: "Leads", icon: Users2 },
]
```

- [ ] **Step 3: Add "Schedule Meeting" to EmailActionPanel**

In `apps/main/src/components/vega/EmailActionPanel.tsx`, add `useRouter` import and `Calendar` icon:

At the top, modify the existing React import line — no change needed there. Add `useRouter` import from `next/navigation`:

```typescript
import { useRouter } from "next/navigation"
```

Add `Calendar` to the lucide import (it already imports from lucide-react):

```typescript
import { Star, Calendar, Clock, AlertCircle, X } from "lucide-react"
```

Inside the `EmailActionPanel` function body, add the router and handler after the existing state declarations:

```typescript
const router = useRouter()

const handleScheduleMeeting = () => {
  const params = new URLSearchParams({
    title: email.subject,
    attendees: email.fromEmail,
    description: email.meetingRequest
      ? `Meeting requested by ${email.fromName}. Topic: ${email.meetingRequest.topic ?? "Not specified"}.`
      : `Follow-up with ${email.fromName}.`,
  })
  router.push(`/workspace/calendar?${params.toString()}`)
}
```

In the "Action Buttons" section (inside `{activeView === null && ...}`), add the Schedule Meeting button between "Draft Reply" and "Follow-up Later":

```typescript
{activeView === null && (
  <div className="flex flex-col gap-2">
    <Button
      onClick={() => setActiveView("reply")}
      style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111", justifyContent: "start" }}
      size="sm"
    >
      Draft Reply
    </Button>
    {email.meetingRequest && (
      <Button
        variant="outline"
        onClick={handleScheduleMeeting}
        style={{
          border: "2px solid #1DBC87",
          color: "#1DBC87",
          justifyContent: "start",
        }}
        size="sm"
      >
        <Calendar className="size-3.5" />
        Schedule Meeting
      </Button>
    )}
    <Button
      variant="outline"
      onClick={() => setActiveView("followup")}
      style={{ border: "2px solid #111", justifyContent: "start" }}
      size="sm"
    >
      <Clock className="size-3.5" />
      Follow-up Later
    </Button>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd apps/main && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/app/(dashboard)/workspace/calendar/page.tsx \
        apps/main/src/components/layout/AppSidebar.tsx \
        apps/main/src/components/vega/EmailActionPanel.tsx
git commit -m "feat(vega): add calendar page, sidebar nav item, and Email→Meeting shortcut in inbox panel"
```

---

## Verification Checklist

After all 10 tasks are complete:

1. **TypeScript clean:** `cd apps/server && npx tsc --noEmit` — no new errors. Same for `apps/main`.
2. **AI service starts:** `cd apps/ai && uvicorn main:app --port 8001` — `/ai/vega/meeting-prep` route appears in docs at `localhost:8001/docs`.
3. **Express routes:** Start server, call `GET /agents/vega/calendar/events` — returns `{ events: [...], slots: [...] }` with mock data.
4. **Calendar page:** Open `/workspace/calendar` — week grid loads with mock events (Team Standup on Monday, Investor Call on Thursday).
5. **Event click:** Click Team Standup — EventSidePanel opens on the right with title, time, attendees.
6. **Prep brief:** Click "Generate Prep Brief" — shows loading skeleton then prep content.
7. **Create event:** Click "+ New Event" — EventCreateForm appears. Fill in title + date + attendees → click "Create Event" → toast "Event created" → new event appears in the grid.
8. **Email→Meeting:** Go to `/workspace/inbox`, click an email with `meetingRequest` detected — "Schedule Meeting" button (green border) appears. Click it — navigates to `/workspace/calendar` with form prefilled.
9. **Sidebar:** "Calendar" nav item appears under Workspace in the sidebar.
