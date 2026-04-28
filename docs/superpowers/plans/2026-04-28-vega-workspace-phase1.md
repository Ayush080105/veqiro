# Vega Workspace Phase 1 — Smart Inbox + Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Smart Inbox workspace page (`/workspace/inbox`) and connect the existing briefing page to real backend data, with follow-up scheduling and VIP contact support.

**Architecture:** Workspace-first (all actions inline, no context switching to chat). New Express endpoints call the existing FastAPI AI service. Gmail/Calendar APIs accessed via existing `googleApis.ts` utilities. Three new Prisma models store follow-ups, VIP contacts, and briefing cache.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS 4, shadcn/ui, TanStack React Query 5, Express 5, Prisma 7, PostgreSQL, FastAPI (Python), Gmail API

---

## File Map

### New Files (create)
- `apps/server/src/modules/agents/vega/vega.workspace.schema.ts` — Zod schemas for new workspace endpoints
- `apps/server/src/modules/agents/vega/vega.workspace.service.ts` — Service functions: getInbox, sendReply, follow-ups, VIP contacts, briefing cache
- `apps/server/src/modules/agents/vega/vega.workspace.controller.ts` — Express handlers for new routes
- `apps/main/src/lib/api/vega-inbox.ts` — Frontend API hooks: useInbox, useSendReply, useSnoozeEmail, useCreateFollowUp
- `apps/main/src/lib/api/vega-followups.ts` — Frontend API hooks: useFollowUps, useCancelFollowUp
- `apps/main/src/lib/api/vega-vip.ts` — Frontend API hooks: useVIPContacts, useAddVIPContact, useRemoveVIPContact
- `apps/main/src/components/vega/EmailCard.tsx` — Single email card (priority badge, sender, summary, action buttons)
- `apps/main/src/components/vega/ReplyEditor.tsx` — Editable reply textarea with send/discard controls
- `apps/main/src/components/vega/EmailActionPanel.tsx` — Right panel: reply editor + follow-up scheduler
- `apps/main/src/components/vega/FollowUpList.tsx` — Follow-ups tab with status and actions
- `apps/main/src/components/vega/InboxView.tsx` — Three-column inbox layout
- `apps/main/src/app/(dashboard)/workspace/inbox/page.tsx` — Inbox workspace page

### Modified Files (edit)
- `apps/server/prisma/schema.prisma` — Add VegaFollowUp, VIPContact, VegaBriefingCache models + enums
- `apps/server/src/common/utils/googleApis.ts` — Add `sendGmailReply` function
- `apps/server/src/modules/agents/vega/vega.types.ts` — Add TriagedEmail, WorkspaceInboxResponse, VegaFollowUpRecord types
- `apps/server/src/modules/agents/vega/vega.routes.ts` — Register new workspace routes
- `apps/main/src/lib/query-keys.ts` — Add workspace query keys
- `apps/main/src/lib/api/briefing.ts` — Replace mock with real backend call
- `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx` — Minor update to use real types from backend
- `apps/main/src/components/layout/AppSidebar.tsx` — Add Inbox to workspaceItems array
- `apps/ai/agents/vega/routes.py` — Add hidden_tasks + suggested_reply to ProcessedEmail Pydantic model

---

## Task 1: Add Prisma Models

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1.1: Add enums and models to schema**

Append to `apps/server/prisma/schema.prisma` after the final `@@map("subscription")` line:

```prisma
enum FollowUpStatus {
  PENDING
  SENT
  CANCELLED
  OVERDUE
}

enum BriefingType {
  MORNING
  EVENING
  WEEKLY
}

model VegaFollowUp {
  id             String         @id @default(cuid())
  emailId        String
  emailSubject   String
  senderEmail    String
  dueAt          DateTime
  draftText      String         @db.Text
  status         FollowUpStatus @default(PENDING)
  organizationId String
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([organizationId, status])
  @@index([dueAt])
  @@map("vega_follow_up")
}

model VIPContact {
  id             String   @id @default(cuid())
  email          String
  name           String?
  organizationId String
  createdAt      DateTime @default(now())

  @@unique([email, organizationId])
  @@index([organizationId])
  @@map("vip_contact")
}

model VegaBriefingCache {
  id             String       @id @default(cuid())
  date           String
  type           BriefingType
  content        Json
  organizationId String
  generatedAt    DateTime     @default(now())

  @@unique([date, type, organizationId])
  @@index([organizationId, date])
  @@map("vega_briefing_cache")
}
```

- [ ] **Step 1.2: Run migration**

```bash
cd apps/server
npx prisma migrate dev --name vega-workspace-phase1
```

Expected: migration file created and applied, no errors.

- [ ] **Step 1.3: Verify migration**

```bash
npx prisma studio
```

Confirm VegaFollowUp, VIPContact, VegaBriefingCache tables appear.

- [ ] **Step 1.4: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/migrations/
git commit -m "feat(db): add vega workspace phase1 models (follow-ups, VIP contacts, briefing cache)"
```

---

## Task 2: Add `sendGmailReply` to googleApis.ts

**Files:**
- Modify: `apps/server/src/common/utils/googleApis.ts`

- [ ] **Step 2.1: Add the function**

Append to the end of `apps/server/src/common/utils/googleApis.ts`:

```typescript
interface SendGmailReplyArgs {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string | null;
  replyToThreadId?: string | null;
}

export const sendGmailReply = async (args: SendGmailReplyArgs) => {
  const raw = base64url(
    buildRfc822({
      to: args.to,
      subject: args.subject.startsWith("Re:") ? args.subject : `Re: ${args.subject}`,
      body: args.body,
      inReplyTo: args.replyToMessageId,
      references: args.replyToMessageId,
    })
  );
  const payload: Record<string, unknown> = { raw };
  if (args.replyToThreadId) {
    (payload as Record<string, unknown>).threadId = args.replyToThreadId;
  }

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${err}`);
  }
  return (await res.json()) as { id: string; threadId: string; labelIds: string[] };
};
```

- [ ] **Step 2.2: Commit**

```bash
git add apps/server/src/common/utils/googleApis.ts
git commit -m "feat(google): add sendGmailReply utility for inbox workspace"
```

---

## Task 3: Extend TypeScript types for workspace

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.types.ts`

- [ ] **Step 3.1: Add new types**

Append to the end of `apps/server/src/modules/agents/vega/vega.types.ts`:

```typescript
export type UICategory = "reply_now" | "action_needed" | "fyi" | "can_ignore";

export interface TriagedEmail {
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  priority: string;
  uiCategory: UICategory;
  summary: string;
  suggestedAction: string;
  hiddenTasks: string[];
  suggestedReply: string | null;
  meetingRequest: { date?: string; time?: string; topic?: string } | null;
  isVIP: boolean;
  receivedAt?: string | null;
  threadId?: string | null;
}

export interface WorkspaceInboxResponse {
  emails: TriagedEmail[];
  stats: InboxStats;
}

export interface SendReplyInput {
  emailId: string;
  threadId?: string | null;
  to: string;
  subject: string;
  body: string;
}

export interface VegaFollowUpRecord {
  id: string;
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "OVERDUE";
  createdAt: string;
}

export interface BriefingCacheEntry {
  id: string;
  date: string;
  type: "MORNING" | "EVENING" | "WEEKLY";
  content: Record<string, unknown>;
  generatedAt: string;
}
```

- [ ] **Step 3.2: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.types.ts
git commit -m "feat(vega): add workspace TypeScript types for inbox, follow-ups, briefing"
```

---

## Task 4: Enhance AI engine ProcessedEmail model

**Files:**
- Modify: `apps/ai/agents/vega/routes.py`

- [ ] **Step 4.1: Locate ProcessedEmail in routes.py**

Open `apps/ai/agents/vega/routes.py`. Find the `ProcessedEmail` Pydantic model (around the top of the file, near class definitions).

- [ ] **Step 4.2: Add new fields to ProcessedEmail**

Find the `ProcessedEmail` class and add `hidden_tasks`, `suggested_reply`, `from_email` fields. The class should look like:

```python
class ProcessedEmail(BaseModel):
    email_id: str
    subject: str
    from_name: str
    from_email: str = ""          # add this
    priority: str
    summary: str
    suggested_action: str
    label_applied: Optional[str] = None
    draft_created: Optional[bool] = False
    draft_id: Optional[str] = None
    hidden_tasks: List[str] = []  # add this
    suggested_reply: Optional[str] = None  # add this
    meeting_request: Optional[Dict[str, str]] = None  # add this
```

If `List`, `Dict`, `Optional` are not already imported at the top of the file, add:
```python
from typing import List, Dict, Optional
```

- [ ] **Step 4.3: Update the process_inbox tool system prompt in agent.py**

Open `apps/ai/agents/vega/agent.py`. Find the `process_inbox` tool definition (the description string for this tool). Update the tool description or the system prompt to instruct the AI to populate the new fields.

Find where the process_inbox results are constructed. After the AI processes emails, the result should include:
- `from_email`: the sender's email address (extracted from the raw Gmail "From" header)
- `hidden_tasks`: list of implicit action items the AI detects (e.g., "review attached doc", "reply before Friday")
- `suggested_reply`: a 1-3 sentence reply suggestion for emails with suggested_action == "reply"
- `meeting_request`: `{"date": "...", "time": "...", "topic": "..."}` if the email contains a meeting request

In the `gmail.py` file, update `list_unread` to also return the `from_email` address (the raw email from the From header), if it doesn't already. The From header typically looks like `"Sarah Chen <sarah@accel.com>"` — extract just `sarah@accel.com`.

- [ ] **Step 4.4: Commit AI engine changes**

```bash
git add apps/ai/agents/vega/routes.py apps/ai/agents/vega/agent.py apps/ai/agents/vega/gmail.py
git commit -m "feat(ai/vega): add hidden_tasks, suggested_reply, from_email to ProcessedEmail"
```

---

## Task 5: Add Workspace Zod schemas

**Files:**
- Create: `apps/server/src/modules/agents/vega/vega.workspace.schema.ts`

- [ ] **Step 5.1: Create the schema file**

```typescript
import { z } from "zod";

export const getInboxSchema = z.object({
  maxEmails: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const sendReplySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  threadId: z.string().optional().nullable(),
});

export const createFollowUpSchema = z.object({
  emailId: z.string().min(1),
  emailSubject: z.string().min(1).max(500),
  senderEmail: z.string().email(),
  dueAt: z.string().datetime(),
  draftText: z.string().min(1).max(5000),
});

export const addVIPContactSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
});

export const generateBriefingSchema = z.object({
  includeEmail: z.boolean().optional().default(true),
  includeCalendar: z.boolean().optional().default(true),
  type: z.enum(["MORNING", "EVENING", "WEEKLY"]).optional().default("MORNING"),
});
```

- [ ] **Step 5.2: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.schema.ts
git commit -m "feat(vega): add workspace Zod schemas for inbox, follow-ups, VIP, briefing"
```

---

## Task 6: Add Workspace Service

**Files:**
- Create: `apps/server/src/modules/agents/vega/vega.workspace.service.ts`

- [ ] **Step 6.1: Create the service file**

```typescript
import { aiService } from "../../../common/utils/aiService.js";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import { sendGmailReply } from "../../../common/utils/googleApis.js";
import { prisma } from "../../../config/prisma.js";
import type {
  ProcessInboxResponse,
  WorkspaceInboxResponse,
  TriagedEmail,
  UICategory,
  SendReplyInput,
  VegaFollowUpRecord,
  BriefingCacheEntry,
  ExecutiveBriefingResponse,
} from "./vega.types.js";
import type {
  getInboxSchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
import type { z } from "zod";

const requireGoogleToken = async (userId: string): Promise<string> => {
  try {
    return await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      throw new BadRequestError(
        "Google account not connected. Connect Gmail + Calendar in Settings → Integrations first."
      );
    }
    throw err;
  }
};

const mapPriorityToCategory = (
  priority: string,
  suggestedAction: string
): UICategory => {
  if (priority === "urgent") return "reply_now";
  if (priority === "high") return "reply_now";
  if (suggestedAction === "schedule") return "reply_now";
  if (priority === "medium") return "action_needed";
  if (suggestedAction === "fyi") return "fyi";
  if (suggestedAction === "ignore" || priority === "low") return "can_ignore";
  return "fyi";
};

export const getInbox = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof getInboxSchema>
): Promise<WorkspaceInboxResponse> => {
  const token = await requireGoogleToken(userId);

  // Fetch VIP emails for this org to mark emails
  const vipContacts = await prisma.vIPContact.findMany({
    where: { organizationId },
    select: { email: true },
  });
  const vipEmails = new Set(vipContacts.map((v) => v.email.toLowerCase()));

  const { data } = await aiService.post<ProcessInboxResponse>(
    "/ai/vega/process-inbox",
    {
      user_id: userId,
      organization_id: organizationId,
      max_emails: input.maxEmails,
      auto_label: false,
      draft_replies: false,
      metadata: { google_access_token: token },
    }
  );

  const emails: TriagedEmail[] = (data.processed ?? []).map((e) => ({
    emailId: e.email_id,
    subject: e.subject,
    fromName: e.from_name,
    fromEmail: (e as unknown as { from_email?: string }).from_email ?? "",
    priority: e.priority,
    uiCategory: mapPriorityToCategory(e.priority, e.suggested_action),
    summary: e.summary,
    suggestedAction: e.suggested_action,
    hiddenTasks: (e as unknown as { hidden_tasks?: string[] }).hidden_tasks ?? [],
    suggestedReply: (e as unknown as { suggested_reply?: string | null }).suggested_reply ?? null,
    meetingRequest: (e as unknown as { meeting_request?: Record<string, string> | null }).meeting_request ?? null,
    isVIP: vipEmails.has(
      ((e as unknown as { from_email?: string }).from_email ?? "").toLowerCase()
    ),
    receivedAt: null,
    threadId: null,
  }));

  // Sort: reply_now first, then action_needed, fyi, can_ignore; VIPs to top of each group
  const categoryOrder: UICategory[] = ["reply_now", "action_needed", "fyi", "can_ignore"];
  emails.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.uiCategory) - categoryOrder.indexOf(b.uiCategory);
    if (catDiff !== 0) return catDiff;
    return a.isVIP === b.isVIP ? 0 : a.isVIP ? -1 : 1;
  });

  return { emails, stats: data.stats };
};

export const sendReply = async (
  userId: string,
  _organizationId: string,
  emailId: string,
  input: SendReplyInput
): Promise<{ messageId: string; threadId: string }> => {
  const token = await requireGoogleToken(userId);
  const sent = await sendGmailReply({
    accessToken: token,
    to: input.to,
    subject: input.subject,
    body: input.body,
    replyToMessageId: emailId,
    replyToThreadId: input.threadId ?? null,
  });
  return { messageId: sent.id, threadId: sent.threadId };
};

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export const getFollowUps = async (
  organizationId: string
): Promise<VegaFollowUpRecord[]> => {
  const records = await prisma.vegaFollowUp.findMany({
    where: { organizationId },
    orderBy: { dueAt: "asc" },
  });
  return records.map((r) => ({
    id: r.id,
    emailId: r.emailId,
    emailSubject: r.emailSubject,
    senderEmail: r.senderEmail,
    dueAt: r.dueAt.toISOString(),
    draftText: r.draftText,
    status: r.status as VegaFollowUpRecord["status"],
    createdAt: r.createdAt.toISOString(),
  }));
};

export const createFollowUp = async (
  organizationId: string,
  input: z.infer<typeof createFollowUpSchema>
): Promise<VegaFollowUpRecord> => {
  const record = await prisma.vegaFollowUp.create({
    data: {
      emailId: input.emailId,
      emailSubject: input.emailSubject,
      senderEmail: input.senderEmail,
      dueAt: new Date(input.dueAt),
      draftText: input.draftText,
      organizationId,
    },
  });
  return {
    id: record.id,
    emailId: record.emailId,
    emailSubject: record.emailSubject,
    senderEmail: record.senderEmail,
    dueAt: record.dueAt.toISOString(),
    draftText: record.draftText,
    status: record.status as VegaFollowUpRecord["status"],
    createdAt: record.createdAt.toISOString(),
  };
};

export const cancelFollowUp = async (
  organizationId: string,
  followUpId: string
): Promise<void> => {
  const existing = await prisma.vegaFollowUp.findFirst({
    where: { id: followUpId, organizationId },
  });
  if (!existing) throw new BadRequestError("Follow-up not found");
  await prisma.vegaFollowUp.update({
    where: { id: followUpId },
    data: { status: "CANCELLED" },
  });
};

// ─── VIP Contacts ─────────────────────────────────────────────────────────────

export const getVIPContacts = async (organizationId: string) => {
  return prisma.vIPContact.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
};

export const addVIPContact = async (
  organizationId: string,
  input: z.infer<typeof addVIPContactSchema>
) => {
  return prisma.vIPContact.upsert({
    where: { email_organizationId: { email: input.email, organizationId } },
    update: { name: input.name ?? undefined },
    create: { email: input.email, name: input.name, organizationId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
};

export const removeVIPContact = async (
  organizationId: string,
  contactId: string
): Promise<void> => {
  const existing = await prisma.vIPContact.findFirst({
    where: { id: contactId, organizationId },
  });
  if (!existing) throw new BadRequestError("VIP contact not found");
  await prisma.vIPContact.delete({ where: { id: contactId } });
};

// ─── Briefing Cache ───────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

export const getBriefingCache = async (
  organizationId: string,
  type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"
): Promise<BriefingCacheEntry | null> => {
  const record = await prisma.vegaBriefingCache.findUnique({
    where: { date_type_organizationId: { date: today(), type, organizationId } },
  });
  if (!record) return null;
  return {
    id: record.id,
    date: record.date,
    type: record.type as BriefingCacheEntry["type"],
    content: record.content as Record<string, unknown>,
    generatedAt: record.generatedAt.toISOString(),
  };
};

export const generateAndCacheBriefing = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof generateBriefingSchema>
): Promise<BriefingCacheEntry> => {
  const token = await requireGoogleToken(userId);
  const { data } = await aiService.post<ExecutiveBriefingResponse>(
    "/ai/vega/executive-briefing",
    {
      user_id: userId,
      organization_id: organizationId,
      include_email: input.includeEmail,
      include_calendar: input.includeCalendar,
      metadata: { google_access_token: token },
    }
  );

  const record = await prisma.vegaBriefingCache.upsert({
    where: {
      date_type_organizationId: {
        date: today(),
        type: input.type,
        organizationId,
      },
    },
    update: { content: data.briefing as object, generatedAt: new Date() },
    create: {
      date: today(),
      type: input.type,
      content: data.briefing as object,
      organizationId,
    },
  });

  return {
    id: record.id,
    date: record.date,
    type: record.type as BriefingCacheEntry["type"],
    content: record.content as Record<string, unknown>,
    generatedAt: record.generatedAt.toISOString(),
  };
};
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.service.ts
git commit -m "feat(vega): add workspace service (inbox, reply, follow-ups, VIP contacts, briefing cache)"
```

---

## Task 7: Add Workspace Controller

**Files:**
- Create: `apps/server/src/modules/agents/vega/vega.workspace.controller.ts`

- [ ] **Step 7.1: Create the controller**

```typescript
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../../common/errors/badRequest.js";
import { UnauthenticatedError } from "../../../common/errors/unauthenticated.js";
import {
  getInboxSchema,
  sendReplySchema,
  createFollowUpSchema,
  addVIPContactSchema,
  generateBriefingSchema,
} from "./vega.workspace.schema.js";
import * as ws from "./vega.workspace.service.js";

const requireAuthContext = (req: Request): { userId: string; organizationId: string } => {
  if (!req.userId || !req.organizationId) {
    throw new UnauthenticatedError("Missing user context");
  }
  return { userId: req.userId, organizationId: req.organizationId };
};

// Inbox
export const getInbox = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = getInboxSchema.parse(req.query);
  const result = await ws.getInbox(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};

export const sendReply = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const { emailId } = req.params;
  if (!emailId) throw new BadRequestError("emailId param required");
  const input = sendReplySchema.parse(req.body);
  const result = await ws.sendReply(userId, organizationId, emailId, input);
  res.status(StatusCodes.OK).json(result);
};

// Follow-ups
export const getFollowUps = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await ws.getFollowUps(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const createFollowUp = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = createFollowUpSchema.parse(req.body);
  const result = await ws.createFollowUp(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const cancelFollowUp = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { followUpId } = req.params;
  if (!followUpId) throw new BadRequestError("followUpId param required");
  await ws.cancelFollowUp(organizationId, followUpId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// VIP Contacts
export const getVIPContacts = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const result = await ws.getVIPContacts(organizationId);
  res.status(StatusCodes.OK).json(result);
};

export const addVIPContact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const input = addVIPContactSchema.parse(req.body);
  const result = await ws.addVIPContact(organizationId, input);
  res.status(StatusCodes.CREATED).json(result);
};

export const removeVIPContact = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const { contactId } = req.params;
  if (!contactId) throw new BadRequestError("contactId param required");
  await ws.removeVIPContact(organizationId, contactId);
  res.status(StatusCodes.NO_CONTENT).send();
};

// Briefing
export const getBriefing = async (req: Request, res: Response) => {
  const { organizationId } = requireAuthContext(req);
  const type = (req.query.type as "MORNING" | "EVENING" | "WEEKLY") ?? "MORNING";
  const result = await ws.getBriefingCache(organizationId, type);
  if (!result) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "No briefing cached for today" });
    return;
  }
  res.status(StatusCodes.OK).json(result);
};

export const generateBriefing = async (req: Request, res: Response) => {
  const { userId, organizationId } = requireAuthContext(req);
  const input = generateBriefingSchema.parse(req.body);
  const result = await ws.generateAndCacheBriefing(userId, organizationId, input);
  res.status(StatusCodes.OK).json(result);
};
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.workspace.controller.ts
git commit -m "feat(vega): add workspace controller handlers"
```

---

## Task 8: Register New Routes

**Files:**
- Modify: `apps/server/src/modules/agents/vega/vega.routes.ts`

- [ ] **Step 8.1: Add workspace routes to the router**

In `apps/server/src/modules/agents/vega/vega.routes.ts`, add the workspace imports and route registrations:

```typescript
import { Router } from "express";
import {
  msgVega,
  getVegaMessages,
  processInbox,
  draftReply,
  calendarSummary,
  createEvent,
  executiveBriefing,
  composeEmail,
} from "./vega.controller.js";
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

const router = Router();

// existing routes
router.post("/chat", msgVega);
router.get("/chat", getVegaMessages);
router.post("/process-inbox", processInbox);
router.post("/draft-reply", draftReply);
router.post("/calendar-summary", calendarSummary);
router.post("/create-event", createEvent);
router.post("/executive-briefing", executiveBriefing);
router.post("/compose-email", composeEmail);

// workspace: inbox
router.get("/inbox", getInbox);
router.post("/inbox/:emailId/reply", sendReply);

// workspace: follow-ups
router.get("/follow-ups", getFollowUps);
router.post("/follow-ups", createFollowUp);
router.delete("/follow-ups/:followUpId", cancelFollowUp);

// workspace: VIP contacts
router.get("/vip-contacts", getVIPContacts);
router.post("/vip-contacts", addVIPContact);
router.delete("/vip-contacts/:contactId", removeVIPContact);

// workspace: briefing cache
router.get("/briefing", getBriefing);
router.post("/briefing/generate", generateBriefing);

export default router;
```

- [ ] **Step 8.2: Test routes with curl**

Start the server (`pnpm dev` from apps/server) and run:

```bash
curl -b "your-session-cookie" http://localhost:3001/api/v1/agents/vega/follow-ups
```

Expected: `[]` (empty array, no auth error).

- [ ] **Step 8.3: Commit**

```bash
git add apps/server/src/modules/agents/vega/vega.routes.ts
git commit -m "feat(vega): register workspace routes (inbox, follow-ups, VIP contacts, briefing)"
```

---

## Task 9: Update Query Keys

**Files:**
- Modify: `apps/main/src/lib/query-keys.ts`

- [ ] **Step 9.1: Add workspace keys**

Replace the entire `qk` object in `apps/main/src/lib/query-keys.ts`:

```typescript
export const qk = {
  brandKit: (organizationId: string) => ["brand-kit", organizationId] as const,
  integrations: () => ["integrations"] as const,
  assistantStatuses: (organizationId: string) =>
    ["assistant-statuses", organizationId] as const,
  lastMessages: () => ["last-messages"] as const,
  chat: (agentSlug: string, organizationId: string) =>
    ["chat", agentSlug, organizationId] as const,
  googleConnected: () => ["auth-accounts", "google"] as const,
  lexSources: () => ["lex", "sources"] as const,
  mayaPublishedPosts: (organizationId: string) =>
    ["maya", "published-posts", organizationId] as const,
  // vega workspace
  vegaInbox: (organizationId: string) => ["vega", "inbox", organizationId] as const,
  vegaFollowUps: (organizationId: string) => ["vega", "follow-ups", organizationId] as const,
  vegaVIPContacts: (organizationId: string) => ["vega", "vip-contacts", organizationId] as const,
  vegaBriefing: (organizationId: string, type: string) =>
    ["vega", "briefing", organizationId, type] as const,
}
```

- [ ] **Step 9.2: Commit**

```bash
git add apps/main/src/lib/query-keys.ts
git commit -m "feat(frontend): add vega workspace query keys"
```

---

## Task 10: Add Frontend API Hooks

**Files:**
- Create: `apps/main/src/lib/api/vega-inbox.ts`
- Create: `apps/main/src/lib/api/vega-followups.ts`
- Create: `apps/main/src/lib/api/vega-vip.ts`
- Modify: `apps/main/src/lib/api/briefing.ts`

- [ ] **Step 10.1: Create vega-inbox.ts**

```typescript
import { apiFetch } from "./client";

export interface TriagedEmail {
  emailId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  priority: string;
  uiCategory: "reply_now" | "action_needed" | "fyi" | "can_ignore";
  summary: string;
  suggestedAction: string;
  hiddenTasks: string[];
  suggestedReply: string | null;
  meetingRequest: { date?: string; time?: string; topic?: string } | null;
  isVIP: boolean;
  receivedAt: string | null;
  threadId: string | null;
}

export interface InboxStats {
  total_processed: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
  drafts_created: number;
  labels_applied: number;
}

export interface InboxResponse {
  emails: TriagedEmail[];
  stats: InboxStats;
}

export async function fetchInbox(maxEmails = 20): Promise<InboxResponse> {
  return apiFetch<InboxResponse>(`/agents/vega/inbox?maxEmails=${maxEmails}`);
}

export async function sendReply(
  emailId: string,
  payload: { to: string; subject: string; body: string; threadId?: string | null }
): Promise<{ messageId: string; threadId: string }> {
  return apiFetch(`/agents/vega/inbox/${emailId}/reply`, {
    method: "POST",
    body: payload,
    agentSlugForNotFound: "vega",
  });
}

// NOTE: follow-up creation is in vega-followups.ts — do NOT add it here.
```

- [ ] **Step 10.2: Create vega-followups.ts**

```typescript
import { apiFetch } from "./client";

export interface FollowUp {
  id: string;
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "OVERDUE";
  createdAt: string;
}

export async function fetchFollowUps(): Promise<FollowUp[]> {
  return apiFetch<FollowUp[]>("/agents/vega/follow-ups");
}

export async function createFollowUp(payload: {
  emailId: string;
  emailSubject: string;
  senderEmail: string;
  dueAt: string;
  draftText: string;
}): Promise<FollowUp> {
  return apiFetch<FollowUp>("/agents/vega/follow-ups", {
    method: "POST",
    body: payload,
  });
}

export async function cancelFollowUp(followUpId: string): Promise<void> {
  return apiFetch(`/agents/vega/follow-ups/${followUpId}`, { method: "DELETE" });
}
```

- [ ] **Step 10.3: Create vega-vip.ts**

```typescript
import { apiFetch } from "./client";

export interface VIPContact {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export async function fetchVIPContacts(): Promise<VIPContact[]> {
  return apiFetch<VIPContact[]>("/agents/vega/vip-contacts");
}

export async function addVIPContact(payload: {
  email: string;
  name?: string;
}): Promise<VIPContact> {
  return apiFetch<VIPContact>("/agents/vega/vip-contacts", {
    method: "POST",
    body: payload,
  });
}

export async function removeVIPContact(contactId: string): Promise<void> {
  return apiFetch(`/agents/vega/vip-contacts/${contactId}`, { method: "DELETE" });
}
```

- [ ] **Step 10.4: Update briefing.ts to call real backend**

Replace the mock `getBriefing` function in `apps/main/src/lib/api/briefing.ts`:

```typescript
import { apiFetch } from "./client";

export interface BriefingSection {
  agent: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface Briefing {
  id: string;
  date: string;
  overview: string;
  sections: BriefingSection[];
  generatedAt?: string;
}

export async function getBriefing(_organizationId: string): Promise<Briefing> {
  // Try to get cached morning briefing
  const cache = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  } | null>("/agents/vega/briefing?type=MORNING").catch(() => null);

  if (cache?.content) {
    // The briefing content from the AI is a record; map it to our Briefing shape
    const c = cache.content;
    return {
      id: cache.id,
      date: cache.date,
      overview: (c.overview as string) ?? "No overview available.",
      sections: (c.sections as BriefingSection[]) ?? [],
      generatedAt: cache.generatedAt,
    };
  }

  // No cache — generate fresh
  const fresh = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  }>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type: "MORNING" },
  });

  const c = fresh.content;
  return {
    id: fresh.id,
    date: fresh.date,
    overview: (c.overview as string) ?? "Briefing generated.",
    sections: (c.sections as BriefingSection[]) ?? [],
    generatedAt: fresh.generatedAt,
  };
}

export async function generateBriefing(type: "MORNING" | "EVENING" | "WEEKLY" = "MORNING"): Promise<Briefing> {
  const fresh = await apiFetch<{
    id: string;
    date: string;
    type: string;
    content: Record<string, unknown>;
    generatedAt: string;
  }>("/agents/vega/briefing/generate", {
    method: "POST",
    body: { includeEmail: true, includeCalendar: true, type },
  });
  const c = fresh.content;
  return {
    id: fresh.id,
    date: fresh.date,
    overview: (c.overview as string) ?? "",
    sections: (c.sections as BriefingSection[]) ?? [],
    generatedAt: fresh.generatedAt,
  };
}
```

- [ ] **Step 10.5: Commit**

```bash
git add apps/main/src/lib/api/vega-inbox.ts apps/main/src/lib/api/vega-followups.ts apps/main/src/lib/api/vega-vip.ts apps/main/src/lib/api/briefing.ts
git commit -m "feat(frontend): add vega workspace API hooks and connect briefing to real backend"
```

---

## Task 11: Add EmailCard Component

**Files:**
- Create: `apps/main/src/components/vega/EmailCard.tsx`

- [ ] **Step 11.1: Create EmailCard**

```tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Star, AlertCircle, MessageSquare, CalendarPlus } from "lucide-react"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

interface EmailCardProps {
  email: TriagedEmail
  isSelected: boolean
  onSelect: (email: TriagedEmail) => void
}

const categoryConfig = {
  reply_now: { label: "Reply Now", color: "#F06464", bg: "#FEF2F2" },
  action_needed: { label: "Action Needed", color: "#F5C518", bg: "#FEFCE8" },
  fyi: { label: "FYI", color: "#6FCDE8", bg: "#F0FAFF" },
  can_ignore: { label: "Can Ignore", color: "#999", bg: "#F5F5F5" },
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function EmailCard({ email, isSelected, onSelect }: EmailCardProps) {
  const cfg = categoryConfig[email.uiCategory]

  return (
    <Card
      onClick={() => onSelect(email)}
      style={{
        border: isSelected ? "2.5px solid #111" : "2px solid #E5E5E5",
        boxShadow: isSelected ? "3px 3px 0 #111" : "none",
        cursor: "pointer",
        transition: "all 0.1s",
        background: isSelected ? "#FFF9ED" : "white",
      }}
    >
      <CardContent className="p-3 flex flex-col gap-1.5">
        {/* Row 1: sender + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {email.isVIP && (
              <Star className="size-3 shrink-0 fill-current" style={{ color: "#F5C518" }} />
            )}
            <span
              className="text-xs font-semibold truncate"
              style={{ fontFamily: "var(--font-mono)", color: "#111" }}
            >
              {email.fromName || email.fromEmail}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {timeAgo(email.receivedAt)}
          </span>
        </div>

        {/* Row 2: subject */}
        <p className="text-xs font-medium truncate text-foreground">{email.subject}</p>

        {/* Row 3: summary */}
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {email.summary}
        </p>

        {/* Row 4: hidden task + category badge */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1 min-w-0">
            {email.hiddenTasks.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                <AlertCircle className="size-3 shrink-0" />
                <span className="truncate">{email.hiddenTasks[0]}</span>
              </div>
            )}
          </div>
          <Badge
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.color}`,
              fontSize: 9,
              letterSpacing: 0.5,
              padding: "1px 6px",
              fontFamily: "var(--font-mono)",
            }}
          >
            {cfg.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 11.2: Commit**

```bash
git add apps/main/src/components/vega/EmailCard.tsx
git commit -m "feat(frontend): add EmailCard component for inbox workspace"
```

---

## Task 12: Add ReplyEditor Component

**Files:**
- Create: `apps/main/src/components/vega/ReplyEditor.tsx`

- [ ] **Step 12.1: Create ReplyEditor**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, X, Loader2 } from "lucide-react"

interface ReplyEditorProps {
  initialDraft: string | null
  onSend: (body: string) => Promise<void>
  onDiscard: () => void
}

export function ReplyEditor({ initialDraft, onSend, onDiscard }: ReplyEditorProps) {
  const [body, setBody] = useState(initialDraft ?? "")
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await onSend(body.trim())
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows={8}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          border: "2px solid #111",
          borderRadius: 8,
          resize: "vertical",
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
          size="sm"
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          {sending ? "Sending…" : "Send Reply"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={sending}>
          <X className="size-3.5" />
          Discard
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {body.length} chars
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 12.2: Commit**

```bash
git add apps/main/src/components/vega/ReplyEditor.tsx
git commit -m "feat(frontend): add ReplyEditor component"
```

---

## Task 13: Add EmailActionPanel Component

**Files:**
- Create: `apps/main/src/components/vega/EmailActionPanel.tsx`

- [ ] **Step 13.1: Create EmailActionPanel**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReplyEditor } from "./ReplyEditor"
import { Star, Calendar, Clock, AlertCircle, X } from "lucide-react"
import { toast } from "sonner"
import { sendReply } from "@/lib/api/vega-inbox"
import { createFollowUp } from "@/lib/api/vega-followups"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

interface EmailActionPanelProps {
  email: TriagedEmail
  onReplySent: () => void
  onFollowUpScheduled: () => void
  onClose: () => void
}

const FOLLOW_UP_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "1 week", hours: 168 },
]

type ActiveView = "reply" | "followup" | null

export function EmailActionPanel({
  email,
  onReplySent,
  onFollowUpScheduled,
  onClose,
}: EmailActionPanelProps) {
  const [activeView, setActiveView] = useState<ActiveView>(
    email.uiCategory === "reply_now" ? "reply" : null
  )
  const [followUpHours, setFollowUpHours] = useState("48")
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false)

  const handleSendReply = async (body: string) => {
    await sendReply(email.emailId, {
      to: email.fromEmail,
      subject: email.subject,
      body,
      threadId: email.threadId,
    })
    toast.success("Reply sent")
    onReplySent()
  }

  const handleScheduleFollowUp = async () => {
    setSchedulingFollowUp(true)
    try {
      const hours = parseInt(followUpHours, 10)
      const dueAt = new Date(Date.now() + hours * 3_600_000).toISOString()
      await createFollowUp({
        emailId: email.emailId,
        emailSubject: email.subject,
        senderEmail: email.fromEmail,
        dueAt,
        draftText: email.suggestedReply ?? `Hi ${email.fromName},\n\nJust following up on this.\n\nBest,`,
      })
      toast.success(`Follow-up scheduled for ${followUpHours}h from now`)
      setActiveView(null)
      onFollowUpScheduled()
    } catch {
      toast.error("Failed to schedule follow-up")
    } finally {
      setSchedulingFollowUp(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {email.isVIP && <Star className="size-3.5 fill-current" style={{ color: "#F5C518" }} />}
            <span className="text-sm font-semibold truncate">{email.fromName}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate">{email.fromEmail}</span>
          <p className="text-xs font-medium mt-1">{email.subject}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* AI Summary */}
      <Card style={{ border: "2px solid #E5E5E5", background: "#FFF9ED" }}>
        <CardContent className="p-3">
          <p className="text-xs leading-relaxed text-foreground">{email.summary}</p>
        </CardContent>
      </Card>

      {/* Hidden Tasks */}
      {email.hiddenTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertCircle className="size-3.5" />
            Hidden Tasks
          </div>
          {email.hiddenTasks.map((task, i) => (
            <div
              key={i}
              className="text-xs text-foreground pl-5"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              · {task}
            </div>
          ))}
        </div>
      )}

      {/* Meeting Request Badge */}
      {email.meetingRequest && (
        <Badge
          style={{ background: "#EEF9F6", color: "#1DBC87", border: "1px solid #1DBC87", alignSelf: "start" }}
        >
          <Calendar className="size-3 mr-1" />
          Meeting request detected
        </Badge>
      )}

      {/* Action Buttons */}
      {activeView === null && (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setActiveView("reply")}
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111", justifyContent: "start" }}
            size="sm"
          >
            Draft Reply
          </Button>
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

      {/* Reply View */}
      {activeView === "reply" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Reply to {email.fromName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => setActiveView(null)}
            >
              ← Back
            </Button>
          </div>
          <ReplyEditor
            initialDraft={email.suggestedReply}
            onSend={handleSendReply}
            onDiscard={() => setActiveView(null)}
          />
        </div>
      )}

      {/* Follow-up View */}
      {activeView === "followup" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Schedule Follow-up</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => setActiveView(null)}
            >
              ← Back
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Vega will remind you to follow up on this email.
          </p>
          <Select value={followUpHours} onValueChange={setFollowUpHours}>
            <SelectTrigger
              style={{ border: "2px solid #111", fontSize: 12, fontFamily: "var(--font-mono)" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <SelectItem key={opt.hours} value={String(opt.hours)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleScheduleFollowUp}
            disabled={schedulingFollowUp}
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            size="sm"
          >
            <Clock className="size-3.5" />
            {schedulingFollowUp ? "Scheduling…" : "Schedule Follow-up"}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 13.2: Commit**

```bash
git add apps/main/src/components/vega/EmailActionPanel.tsx
git commit -m "feat(frontend): add EmailActionPanel with reply editor and follow-up scheduler"
```

---

## Task 14: Add FollowUpList Component

**Files:**
- Create: `apps/main/src/components/vega/FollowUpList.tsx`

- [ ] **Step 14.1: Create FollowUpList**

```tsx
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchFollowUps, cancelFollowUp } from "@/lib/api/vega-followups"
import { qk } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, X } from "lucide-react"
import { toast } from "sonner"

const statusConfig = {
  PENDING: { label: "Pending", color: "#F5C518" },
  SENT: { label: "Sent", color: "#1DBC87" },
  CANCELLED: { label: "Cancelled", color: "#999" },
  OVERDUE: { label: "Overdue", color: "#F06464" },
}

function formatDueAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function FollowUpList() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const { data: followUps, isLoading } = useQuery({
    queryKey: qk.vegaFollowUps(organizationId),
    queryFn: fetchFollowUps,
    enabled: !!organizationId,
  })

  const cancel = useMutation({
    mutationFn: cancelFollowUp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.vegaFollowUps(organizationId) })
      toast.success("Follow-up cancelled")
    },
    onError: () => toast.error("Failed to cancel follow-up"),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!followUps?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Clock className="size-8 opacity-30" />
        <p className="text-sm">No follow-ups scheduled</p>
        <p className="text-xs">Select an email and choose "Follow-up Later" to add one.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {followUps.map((f) => {
        const cfg = statusConfig[f.status]
        return (
          <div
            key={f.id}
            style={{
              border: "2px solid #E5E5E5",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold truncate">{f.emailSubject}</span>
                <span className="text-[11px] text-muted-foreground">{f.senderEmail}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  style={{
                    background: "transparent",
                    color: cfg.color,
                    border: `1px solid ${cfg.color}`,
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {cfg.label}
                </Badge>
                {f.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => cancel.mutate(f.id)}
                    disabled={cancel.isPending}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="size-3" />
              Due: {formatDueAt(f.dueAt)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 14.2: Commit**

```bash
git add apps/main/src/components/vega/FollowUpList.tsx
git commit -m "feat(frontend): add FollowUpList component"
```

---

## Task 15: Add InboxView Component

**Files:**
- Create: `apps/main/src/components/vega/InboxView.tsx`

- [ ] **Step 15.1: Create InboxView**

```tsx
"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchInbox } from "@/lib/api/vega-inbox"
import { qk } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"
import { EmailCard } from "./EmailCard"
import { EmailActionPanel } from "./EmailActionPanel"
import { FollowUpList } from "./FollowUpList"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AlertCircle, RefreshCw, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TriagedEmail } from "@/lib/api/vega-inbox"

const CATEGORIES = ["reply_now", "action_needed", "fyi", "can_ignore"] as const
const CATEGORY_LABELS = {
  reply_now: "Reply Now",
  action_needed: "Action Needed",
  fyi: "FYI",
  can_ignore: "Can Ignore",
}

export function InboxView() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const [selectedEmail, setSelectedEmail] = useState<TriagedEmail | null>(null)
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: qk.vegaInbox(organizationId),
    queryFn: () => fetchInbox(20),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  })

  const invalidateInbox = () =>
    queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })

  const emailsByCategory = CATEGORIES.map((cat) => ({
    cat,
    emails: data?.emails.filter((e) => e.uiCategory === cat) ?? [],
  }))

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        <div className="w-72 shrink-0 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <AlertCircle className="size-8 text-destructive opacity-60" />
        <p className="text-sm font-medium">Could not load inbox</p>
        <p className="text-xs text-muted-foreground">Check your Google connection in Settings → Integrations</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left: email list with tabs */}
      <div
        className="flex flex-col shrink-0"
        style={{ width: 320, borderRight: "2px solid #E5E5E5" }}
      >
        <Tabs defaultValue="inbox" className="flex flex-col h-full min-h-0">
          <div
            className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0"
            style={{ borderBottom: "2px solid #E5E5E5" }}
          >
            <TabsList style={{ background: "#F5F5F5" }}>
              <TabsTrigger value="inbox" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                Inbox
              </TabsTrigger>
              <TabsTrigger value="followups" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                Follow-ups
              </TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <TabsContent value="inbox" className="flex-1 overflow-y-auto m-0 p-3 flex flex-col gap-4">
            {emailsByCategory.map(({ cat, emails }) => {
              if (!emails.length) return null
              return (
                <div key={cat} className="flex flex-col gap-2">
                  <div
                    className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {CATEGORY_LABELS[cat]} ({emails.length})
                  </div>
                  {emails.map((email) => (
                    <EmailCard
                      key={email.emailId}
                      email={email}
                      isSelected={selectedEmail?.emailId === email.emailId}
                      onSelect={setSelectedEmail}
                    />
                  ))}
                </div>
              )
            })}

            {!data?.emails.length && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Mail className="size-8 opacity-30" />
                <p className="text-sm">Inbox is empty</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="followups" className="flex-1 overflow-y-auto m-0">
            <FollowUpList />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: action panel */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {selectedEmail ? (
          <EmailActionPanel
            email={selectedEmail}
            onReplySent={() => {
              setSelectedEmail(null)
              invalidateInbox()
            }}
            onFollowUpScheduled={() => {
              queryClient.invalidateQueries({ queryKey: qk.vegaFollowUps(organizationId) })
            }}
            onClose={() => setSelectedEmail(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Mail className="size-10 opacity-20" />
            <p className="text-sm">Select an email to see details</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 15.2: Commit**

```bash
git add apps/main/src/components/vega/InboxView.tsx
git commit -m "feat(frontend): add InboxView three-column layout component"
```

---

## Task 16: Create Inbox Page

**Files:**
- Create: `apps/main/src/app/(dashboard)/workspace/inbox/page.tsx`

- [ ] **Step 16.1: Create the page**

```tsx
import { InboxView } from "@/components/vega/InboxView"
import { PageHeader } from "@/components/ui/page-header"

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-4 pb-4">
      <PageHeader
        kicker="vega"
        title="smart inbox"
        subtitle="AI-triaged email — reply, schedule, or follow up without leaving Veqiro."
        sticker={{ label: "inbox", rot: 3, color: "var(--vq-violet)" }}
      />
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl" style={{ border: "2.5px solid #111", boxShadow: "4px 4px 0 #111" }}>
        <InboxView />
      </div>
    </div>
  )
}
```

- [ ] **Step 16.2: Commit**

```bash
git add "apps/main/src/app/(dashboard)/workspace/inbox/page.tsx"
git commit -m "feat(frontend): add /workspace/inbox page"
```

---

## Task 17: Update AppSidebar

**Files:**
- Modify: `apps/main/src/components/layout/AppSidebar.tsx`

- [ ] **Step 17.1: Add Inbox to workspaceItems and import Mail icon**

In `apps/main/src/components/layout/AppSidebar.tsx`:

1. In the imports section at the top, add `Mail` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  FileText,
  Newspaper,
  Users2,
  ChevronDown,
  LogOut,
  Mail,
} from "lucide-react"
```

2. Update `workspaceItems` at line 40:

```typescript
const workspaceItems = [
  { href: "/workspace/briefing", label: "Briefing", icon: Newspaper },
  { href: "/workspace/inbox", label: "Inbox", icon: Mail },
  { href: "/workspace/content", label: "Content", icon: FileText },
  { href: "/workspace/leads", label: "Leads", icon: Users2 },
]
```

- [ ] **Step 17.2: Commit**

```bash
git add apps/main/src/components/layout/AppSidebar.tsx
git commit -m "feat(frontend): add Inbox link to workspace sidebar"
```

---

## Task 18: Update Briefing Page

**Files:**
- Modify: `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`

- [ ] **Step 18.1: Update the loadBriefing function**

In the briefing page, the existing `loadBriefing` function already calls `getBriefing(organizationId)`. Since we updated `briefing.ts` to call the real backend in Task 10, this page will now fetch real data automatically.

However, we need to add a "Refresh Briefing" button that calls `generateBriefing`. Find the page's `loadBriefing` function and update it to optionally force-regenerate:

In `apps/main/src/app/(dashboard)/workspace/briefing/page.tsx`, add an import for `generateBriefing`:

```typescript
import { getBriefing, generateBriefing, type Briefing, type BriefingSection } from "@/lib/api/briefing"
```

Then update the `BriefingPage` component to handle the refresh button. The existing [Regenerate] button in `SectionCard` doesn't do anything yet. Update the main refresh button to call `generateBriefing`:

Find the `loadBriefing` function and add an optional `forceRefresh` parameter:

```typescript
async function loadBriefing(forceRefresh = false) {
  setLoading(true)
  setError(false)
  try {
    const data = forceRefresh
      ? await generateBriefing("MORNING")
      : await getBriefing(organizationId)
    setBriefing(data)
  } catch {
    setError(true)
  } finally {
    setLoading(false)
  }
}
```

Find where "Refresh Briefing" button would go (or find the existing skeleton area near the `PageHeader`) and add:

```tsx
<Button variant="outline" size="sm" onClick={() => loadBriefing(true)} disabled={loading}>
  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
  Refresh Briefing
</Button>
```

Add `RefreshCw` to the lucide-react imports at the top if not already there.

- [ ] **Step 18.2: Commit**

```bash
git add "apps/main/src/app/(dashboard)/workspace/briefing/page.tsx"
git commit -m "feat(frontend): connect briefing page to real Vega backend data"
```

---

## Self-Review Checklist

Run through before calling Phase 1 complete:

- [ ] `prisma migrate status` shows no pending migrations
- [ ] `GET /agents/vega/inbox` returns emails (not 500) when Google is connected
- [ ] `POST /agents/vega/follow-ups` creates a DB record
- [ ] `GET /agents/vega/briefing/generate` returns a briefing JSON
- [ ] `/workspace/inbox` renders without JS errors in browser console
- [ ] Email card click opens the action panel
- [ ] Reply editor pre-fills with AI draft and sends successfully
- [ ] Follow-up tab shows scheduled follow-ups
- [ ] `/workspace/briefing` shows real data (not mock)
- [ ] Inbox nav item appears in sidebar
- [ ] TypeScript compiles with no errors: `pnpm tsc --noEmit` in apps/main and apps/server

---

## What's Next (Phase 2)

Phase 2 will cover `/workspace/calendar` — week/day event view, meeting prep cards, conflict detection, reschedule flows, and Email → Meeting conversion.
