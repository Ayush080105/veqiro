import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from core.utils import strip_json_fences, safe_json_loads
from agents.vega.agent import VegaAgent
from agents.vega.gmail import list_unread, get_message, create_label, label_message
from agents.vega.calendar import list_events, create_event, find_free_slots

router = APIRouter(prefix="/ai/vega", tags=["Vega"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = VegaAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

DEFAULT_LABEL_DEFINITIONS = [
    {"name": "Investors", "rationale": "Investor, fundraising, diligence, metrics, deck, term sheet, VC, angel, shareholder, or board-related communication."},
    {"name": "Sales Leads", "rationale": "Prospects, demos, pricing, trials, purchasing intent, inbound leads, customer evaluation, or sales follow-up."},
    {"name": "Newsletters", "rationale": "Subscriptions, digests, marketing newsletters, product updates, event roundups, or automated broadcasts with no direct action required."},
    {"name": "Team", "rationale": "Internal teammates, collaborators, hiring, operations, project coordination, status updates, or work planning."},
    {"name": "Legal", "rationale": "Contracts, compliance, terms, privacy, legal notices, signatures, policies, or regulatory matters."},
    {"name": "Finance", "rationale": "Invoices, receipts, payments, accounting, payroll, banking, taxes, or financial operations."},
    {"name": "Other", "rationale": "Use only when the email does not clearly match another configured label."},
]


def _coerce_label_definitions(label_definitions=None, custom_labels=None) -> list[dict]:
    definitions = []
    for item in label_definitions or []:
        if isinstance(item, BaseModel):
            item = item.model_dump()
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if name:
            definitions.append({
                "name": name,
                "rationale": str(item.get("rationale", "") or "No rationale provided.").strip(),
            })
    if definitions:
        return definitions
    if custom_labels:
        return [{"name": str(name), "rationale": "No rationale provided."} for name in custom_labels if str(name).strip()]
    return DEFAULT_LABEL_DEFINITIONS


def _label_names(label_definitions: list[dict]) -> list[str]:
    return [label["name"] for label in label_definitions]


def _label_prompt(label_definitions: list[dict]) -> str:
    return "\n".join(
        f"- {label['name']}: {label.get('rationale') or 'No rationale provided.'}"
        for label in label_definitions
    )


def _normalize_label(label: str | None, label_definitions: list[dict]) -> str:
    names = _label_names(label_definitions)
    if label:
        lower = label.lower().removeprefix("vega/")
        for name in names:
            if name.lower() == lower:
                return name
    return next((name for name in names if name.lower() == "other"), names[0] if names else "Other")


class LabelDefinition(BaseModel):
    name: str
    rationale: str = ""


class ProcessInboxRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    max_emails: int = 20
    auto_label: bool = True
    draft_replies: bool = True
    skip_labeled: bool = False  # cron-only: skip emails that already have a managed label
    custom_labels: list[str] = []
    label_definitions: list[LabelDefinition] = []
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "max_emails": 10,
                "auto_label": True,
                "draft_replies": True,
                "custom_labels": ["Investors", "Sales Leads", "Newsletters"],
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class ProcessedEmail(BaseModel):
    email_id: str
    subject: str
    from_name: str
    from_email: str = ""          # sender's email address
    priority: str
    summary: str
    suggested_action: str
    label_applied: str | None = None
    draft_created: bool = False
    draft_id: str | None = None
    hidden_tasks: list[str] = []  # implicit action items detected
    suggested_reply: str | None = None  # 1-3 sentence reply suggestion
    meeting_request: dict | None = None  # {date, time, topic} if meeting detected


class InboxStats(BaseModel):
    total_processed: int
    urgent: int
    high: int
    medium: int
    low: int
    drafts_created: int
    labels_applied: int


class ProcessInboxResponse(BaseModel):
    processed: list[ProcessedEmail]
    stats: InboxStats
    node_actions: list[dict] = []
    tokens_used: int = 0
    model_used: str = ""


class DraftReplyRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    email_id: str
    reply_instructions: str
    tone: str = "professional"
    save_as_draft: bool = True
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "email_id": "msg_001",
                "reply_instructions": "Accept the meeting, propose Thursday 3pm EST, attach our metrics deck",
                "tone": "professional and enthusiastic",
                "save_as_draft": True,
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class DraftReplyResponse(BaseModel):
    draft: dict
    suggested_follow_up: str
    node_actions: list[dict] = []
    tokens_used: int = 0
    model_used: str = ""


class CalendarSummaryRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    days_ahead: int = 7
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "days_ahead": 7,
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class CalendarSummaryResponse(BaseModel):
    events: list[dict]
    conflicts: list[dict]
    free_slots: list[dict]
    daily_summary: dict
    tokens_used: int = 0
    model_used: str = ""


class CreateEventRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    description: str
    check_conflicts: bool = True
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "description": "Schedule a 30-minute call with Marcus Rivera from GrowthCo on Wednesday April 2nd at 10am EST",
                "check_conflicts": True,
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class CreateEventResponse(BaseModel):
    event: dict
    conflicts: list[dict]
    google_event_id: str
    created: bool
    node_actions: list[dict] = []
    tokens_used: int = 0
    model_used: str = ""


class ExecutiveBriefingRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    include_email: bool = True
    include_calendar: bool = True
    label_definitions: list[LabelDefinition] = []
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "include_email": True,
                "include_calendar": True,
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class ExecutiveBriefingResponse(BaseModel):
    briefing: dict
    tokens_used: int = 0
    model_used: str = ""


class ComposeEmailRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    to: str
    subject: str
    instructions: str
    tone: str = "professional"
    include_cta: bool = True
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "to": "investor@accel.com",
                "subject": "Veqiro AI — March 2025 Update",
                "instructions": "Write a concise investor update email highlighting MRR growth to $58K and two new enterprise pilots. Request a 30-min call.",
                "tone": "professional and enthusiastic",
                "include_cta": True,
                "metadata": {"google_access_token": "ya29.xxx"},
            }
        }
    )


class ComposeEmailResponse(BaseModel):
    draft: dict
    node_actions: list[dict] = []
    tokens_used: int = 0
    model_used: str = ""


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


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Vega chat")
async def vega_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Vega's executive assistant response. node_actions in metadata for backend to execute."""
    return await _agent.chat_sync(request)


@router.post("/process-inbox", response_model=ProcessInboxResponse, summary="Process email inbox")
async def process_inbox(request: ProcessInboxRequest) -> ProcessInboxResponse:
    """Triage, label, and draft replies for unread emails. Returns node_actions for backend."""
    token = request.metadata.get("google_access_token", "") or "mock-token"
    emails = await list_unread(token, max_results=request.max_emails)
    label_definitions = _coerce_label_definitions(request.label_definitions, request.custom_labels)
    managed_label_names = {name.lower() for name in _label_names(label_definitions)}

    # Cron-only: skip emails that already carry a managed label or legacy Vega/* label
    if request.skip_labeled and token and token != "mock-token":
        try:
            from agents.vega.gmail import list_labels as _list_labels
            all_labels = await _list_labels(token)
            vega_label_ids = {
                l["id"]
                for l in all_labels
                if l["name"].lower() in managed_label_names
                or (
                    l["name"].lower().startswith("vega/")
                    and l["name"].lower()[5:] in managed_label_names
                )
            }
            emails = [e for e in emails if not any(lid in vega_label_ids for lid in e.get("labels", []))]
        except Exception:
            pass

    if settings.MOCK_MODE:
        processed = [
            ProcessedEmail(
                email_id="msg_001",
                subject="RE: Veqiro AI – Seed Round Interest",
                from_name="Sarah Chen (Accel Partners)",
                priority="urgent",
                summary="Investor follow-up from TechCrunch Disrupt. Requesting 45-min diligence call + metrics deck. Two time slot options offered (Thu 3-5pm, Fri 2-4pm EST).",
                suggested_action="Reply promptly – confirm time slot and send deck",
                label_applied="Investors",
                draft_created=True,
                draft_id="draft_001_mock",
            ),
            ProcessedEmail(
                email_id="msg_002",
                subject="Today's top products on Product Hunt",
                from_name="Product Hunt Newsletter",
                priority="low",
                summary="Marketing newsletter – no action needed.",
                suggested_action="Archive",
                label_applied="Newsletters",
                draft_created=False,
            ),
            ProcessedEmail(
                email_id="msg_003",
                subject="Interested in Veqiro AI for our 40-person team",
                from_name="Marcus Rivera (GrowthCo)",
                priority="high",
                summary="Qualified sales lead. 40-person team, $8K/month current spend, wants demo of analytics + content features.",
                suggested_action="Schedule demo call",
                label_applied="Sales Leads",
                draft_created=True,
                draft_id="draft_002_mock",
            ),
        ]
        stats = InboxStats(total_processed=3, urgent=1, high=1, medium=0, low=1, drafts_created=2, labels_applied=3)
        node_actions = [
            {
                "node_action": "label_messages",
                "messages": [
                    {"email_id": "msg_001", "label": "Investors"},
                    {"email_id": "msg_002", "label": "Newsletters"},
                    {"email_id": "msg_003", "label": "Sales Leads"},
                ],
            }
        ]
        return ProcessInboxResponse(processed=processed, stats=stats, node_actions=node_actions)

    import asyncio

    label_list = ", ".join(_label_names(label_definitions))
    label_rationales = _label_prompt(label_definitions)
    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"

    async def _analyze_email(email: dict) -> tuple[ProcessedEmail, int]:
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": (
                f"## Available Labels\n{label_rationales}\n\n"
                "## Classification Rules\n"
                "1. Use the sender's email address and domain as a primary signal.\n"
                "2. Choose the label whose rationale best matches the email's purpose and sender.\n"
                "3. Automated alerts, transactional notifications, newsletters, and digests from known services "
                "should match by content — not default to Sales Leads.\n"
                "4. Use 'Other' only when no rationale clearly fits.\n\n"
                "## Email\n"
                f"From: {email.get('from', '')}\n"
                f"Subject: {email.get('subject', '')}\n"
                f"Body:\n{email.get('body', email.get('snippet', ''))[:1500]}\n\n"
                "## Task\n"
                "Analyze the email above. Return ONLY a JSON object (no markdown fences) with these keys:\n"
                "- priority: urgent | high | medium | low\n"
                "- summary: 1-2 sentence summary\n"
                "- suggested_action: string\n"
                f"- label: exactly one of: {label_list}\n"
                "- hidden_tasks: list of implicit action items (strings)\n"
                "- suggested_reply: 1-3 sentence reply if suggested_action is 'reply', else null\n"
                "- meeting_request: object with date, time, topic if meeting is requested, else null\n"
            )}],
        )
        tokens = _llm.count_tokens(raw)
        try:
            analysis = safe_json_loads(raw)
            priority = analysis.get("priority", "medium")
            summary = analysis.get("summary", raw[:300])
            suggested_action = analysis.get("suggested_action", "review")
            label = _normalize_label(analysis.get("label", "Other"), label_definitions)
            hidden_tasks = analysis.get("hidden_tasks", [])
            suggested_reply = analysis.get("suggested_reply", None)
            meeting_request = analysis.get("meeting_request", None)
        except Exception:
            priority = "medium"
            summary = raw[:300]
            suggested_action = "review"
            label = _normalize_label("Other", label_definitions)
            hidden_tasks = []
            suggested_reply = None
            meeting_request = None

        result = ProcessedEmail(
            email_id=email.get("id", ""),
            subject=email.get("subject", ""),
            from_name=email.get("from_name", email.get("from", "")),
            from_email=email.get("from_email", ""),
            priority=priority,
            summary=summary,
            suggested_action=suggested_action,
            label_applied=label,
            hidden_tasks=hidden_tasks,
            suggested_reply=suggested_reply,
            meeting_request=meeting_request,
        )
        return result, tokens

    results = await asyncio.gather(*[_analyze_email(e) for e in emails[:request.max_emails]])

    processed = []
    total_tokens = 0
    stats_counts = {"urgent": 0, "high": 0, "medium": 0, "low": 0}
    label_messages_list = []

    for pe, tok in results:
        total_tokens += tok
        stats_counts[pe.priority] = stats_counts.get(pe.priority, 0) + 1
        label_messages_list.append({"email_id": pe.email_id, "label": pe.label_applied or "Other"})
        processed.append(pe)

    stats = InboxStats(
        total_processed=len(processed),
        urgent=stats_counts.get("urgent", 0),
        high=stats_counts.get("high", 0),
        medium=stats_counts.get("medium", 0),
        low=stats_counts.get("low", 0),
        drafts_created=0,
        labels_applied=len(label_messages_list),
    )
    node_actions = [{"node_action": "label_messages", "messages": label_messages_list}]
    return ProcessInboxResponse(processed=processed, stats=stats, node_actions=node_actions, tokens_used=total_tokens, model_used=_agent.default_model)


@router.post("/draft-reply", response_model=DraftReplyResponse, summary="Draft email reply")
async def draft_reply(request: DraftReplyRequest) -> DraftReplyResponse:
    """Draft a contextually appropriate email reply. Returns node_action for backend to create Gmail draft."""
    token = request.metadata.get("google_access_token", "") or "mock-token"

    if settings.MOCK_MODE:
        body = (
            "Hi Sarah,\n\nThank you so much for following up – and it was great meeting you at Disrupt!\n\n"
            "Thursday at 3pm EST works perfectly for me. I'll send a calendar invite momentarily.\n\n"
            "I'll attach our latest metrics deck to this email – happy to walk you through the numbers live, "
            "but wanted to give you a head start.\n\n"
            "Quick highlights: MRR hit $58K last month (39% MoM growth), churn is tracking at 2.1%, "
            "and we have 248 active subscribers with strong expansion revenue.\n\n"
            "Looking forward to the conversation!\n\n"
            "Best,\nAlex\nFounder & CEO, Veqiro AI\n+1 (415) 555-0123"
        )
        node_action = {
            "node_action": "create_gmail_draft",
            "to": "sarah.chen@accelpartners.com",
            "subject": "RE: Veqiro AI – Seed Round Interest",
            "body": body,
            "reply_to_message_id": request.email_id,
            "reply_to_thread_id": None,
        }
        return DraftReplyResponse(
            draft={
                "to": "sarah.chen@accelpartners.com",
                "subject": "RE: Veqiro AI – Seed Round Interest",
                "body": body,
                "saved": request.save_as_draft,
            },
            suggested_follow_up="Follow up Friday April 4th if no confirmation received by Thursday morning",
            node_actions=[node_action],
        )

    email = await get_message(token, request.email_id)
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Draft a {request.tone} reply to this email:\n\n"
            f"From: {email.get('from', '')}\n"
            f"Subject: {email.get('subject', '')}\n"
            f"Body: {email.get('body', email.get('snippet', ''))[:1500]}\n\n"
            f"Instructions: {request.reply_instructions}"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    node_action = {
        "node_action": "create_gmail_draft",
        "to": email.get("from", ""),
        "subject": f"RE: {email.get('subject', '')}",
        "body": raw,
        "reply_to_message_id": request.email_id,
        "reply_to_thread_id": email.get("thread_id", ""),
    }
    return DraftReplyResponse(
        draft={"to": email.get("from", ""), "subject": f"RE: {email.get('subject', '')}", "body": raw, "saved": request.save_as_draft},
        suggested_follow_up="Follow up in 48 hours if no response",
        node_actions=[node_action],
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/calendar-summary", response_model=CalendarSummaryResponse, summary="Summarize calendar")
async def calendar_summary(request: CalendarSummaryRequest) -> CalendarSummaryResponse:
    """Get a comprehensive calendar overview with conflict detection and free slots."""
    token = request.metadata.get("google_access_token", "") or "mock-token"
    now = datetime.now(timezone.utc)
    date_range = {
        "start": now.isoformat(),
        "end": (now + timedelta(days=request.days_ahead)).isoformat(),
    }
    # Run both Google Calendar API calls in parallel — they're independent
    events, free_slots = await asyncio.gather(
        list_events(token, days_ahead=request.days_ahead),
        find_free_slots(token, date_range),
    )

    if settings.MOCK_MODE:
        return CalendarSummaryResponse(
            events=events,
            conflicts=[],
            free_slots=free_slots,
            daily_summary={
                "2025-03-31": {"events": ["Team Standup (9am)"], "free_hours": 7.5, "focus_time": "10am-5pm"},
                "2025-04-01": {"events": [], "free_hours": 9, "focus_time": "Full day available"},
                "2025-04-02": {"events": [], "free_hours": 9, "focus_time": "Full day available"},
                "2025-04-03": {"events": ["Investor Call – Accel (3pm)"], "free_hours": 6.5, "focus_time": "9am-2:30pm"},
            },
        )

    # Detect conflicts: events on the same day whose times overlap
    conflicts = []
    sorted_events = sorted(events, key=lambda e: e.get("start", ""))
    for i in range(len(sorted_events) - 1):
        e1 = sorted_events[i]
        e2 = sorted_events[i + 1]
        e1_end = e1.get("end", "")
        e2_start = e2.get("start", "")
        if e1_end and e2_start and e1_end > e2_start:
            conflicts.append({
                "event_1": e1.get("title", ""),
                "event_1_end": e1_end,
                "event_2": e2.get("title", ""),
                "event_2_start": e2_start,
            })

    return CalendarSummaryResponse(
        events=events,
        conflicts=conflicts,
        free_slots=free_slots,
        daily_summary={},
    )


@router.post("/create-event", response_model=CreateEventResponse, summary="Create calendar event")
async def create_calendar_event(request: CreateEventRequest) -> CreateEventResponse:
    """Parse natural language description and return node_action for backend to create calendar event."""
    token = request.metadata.get("google_access_token", "") or "mock-token"

    if settings.MOCK_MODE:
        node_action = {
            "node_action": "create_calendar_event",
            "title": "Demo Call – Marcus Rivera (GrowthCo)",
            "start": "2025-04-02T15:00:00Z",
            "end": "2025-04-02T15:30:00Z",
            "attendees": ["founder@veqiroai.com", "marcus@growthco.io"],
            "description": request.description,
            "add_google_meet": True,
        }
        return CreateEventResponse(
            event={
                "id": "event_new_mock",
                "title": "Demo Call – Marcus Rivera (GrowthCo)",
                "start": "2025-04-02T15:00:00Z",
                "end": "2025-04-02T15:30:00Z",
                "attendees": ["founder@veqiroai.com", "marcus@growthco.io"],
                "meet_link": "https://meet.google.com/xyz-mock",
                "status": "confirmed",
            },
            conflicts=[],
            google_event_id="event_new_mock",
            created=True,
            node_actions=[node_action],
        )

    now = datetime.now(timezone.utc)
    next_day = (now + timedelta(days=1)).strftime("%Y-%m-%d")

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Today is {now.strftime('%A, %Y-%m-%d')} UTC.\n"
            f"Parse this event description into structured data:\n{request.description}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "title (string), start (ISO 8601 UTC datetime), end (ISO 8601 UTC datetime), "
            "attendees (list of email strings), description (string)"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        event_data = safe_json_loads(raw)
    except Exception:
        event_data = {
            "title": request.description[:50],
            "start": f"{next_day}T10:00:00Z",
            "end": f"{next_day}T11:00:00Z",
            "attendees": [],
            "description": request.description,
        }

    conflicts = []
    if request.check_conflicts:
        existing = await list_events(token, days_ahead=14)
        for e in existing:
            if e.get("start", "")[:10] == event_data.get("start", "")[:10]:
                conflicts.append({"event": e.get("title", ""), "time": e.get("start", "")})

    node_action = {
        "node_action": "create_calendar_event",
        "title": event_data.get("title", ""),
        "start": event_data.get("start", ""),
        "end": event_data.get("end", ""),
        "attendees": event_data.get("attendees", []),
        "description": event_data.get("description", ""),
        "add_google_meet": True,
    }
    return CreateEventResponse(
        event=event_data,
        conflicts=conflicts,
        google_event_id=event_data.get("title", "new_event"),
        created=True,
        node_actions=[node_action],
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/executive-briefing", response_model=ExecutiveBriefingResponse, summary="Executive daily briefing")
async def executive_briefing(request: ExecutiveBriefingRequest) -> ExecutiveBriefingResponse:
    """Generate a comprehensive executive briefing combining email, calendar, and context."""
    token = request.metadata.get("google_access_token", "") or "mock-token"
    label_definitions = _coerce_label_definitions(request.label_definitions)
    managed_label_names = {name.lower() for name in _label_names(label_definitions)}

    if settings.MOCK_MODE:
        return ExecutiveBriefingResponse(
            briefing={
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "good_morning": "Good morning! Here's your executive briefing for today.",
                "priority_score": "High-activity day",
                "urgent_actions": [
                    {
                        "action": "Reply to Sarah Chen (Accel Partners) – investor diligence call request",
                        "deadline": "Today by 5pm EST",
                        "context": "She offered Thu 3-5pm or Fri 2-4pm EST. Confirm time + send metrics deck.",
                        "email_id": "msg_001",
                    },
                    {
                        "action": "Follow up with Marcus Rivera (GrowthCo) – schedule demo call",
                        "deadline": "Tomorrow",
                        "context": "40-person team, $8K/month spend, qualified lead. Book via Calendly or direct email.",
                        "email_id": "msg_003",
                    },
                ],
                "today_schedule": [
                    {"time": "09:00 AM", "event": "Team Standup", "location": "Google Meet", "prep_needed": "Review yesterday's blockers"},
                ],
                "upcoming_this_week": [
                    {"day": "Thursday Apr 3", "event": "Investor Call – Accel Partners", "prep": "Send metrics deck by Wednesday EOD"},
                ],
                "email_summary": {"total_unread": 3, "urgent": 1, "high": 1, "low": 1},
                "financial_status": "MRR at $58K (+8% MoM), runway 14 months. No critical alerts.",
                "free_time_today": "10am-5pm EST (7.5 hours)",
                "focus_recommendation": "Block 10am-12pm for deep work. Do investor reply before standup.",
                "generated_at": datetime.utcnow().isoformat(),
            }
        )

    emails = []
    email_by_label: dict = {}
    if request.include_email:
        from email.utils import parsedate_to_datetime
        from datetime import date as _date
        import asyncio as _asyncio
        all_unread = await list_unread(token, max_results=50)
        today = _date.today().isoformat()
        def _is_today(email_date: str) -> bool:
            try:
                return parsedate_to_datetime(email_date).date().isoformat() == today
            except Exception:
                return False
        emails = [e for e in all_unread if _is_today(e.get("date", ""))]

        # Build label breakdown from actual Gmail label names (Vega applies these via cron)
        if emails and token and token != "mock-token":
            try:
                from googleapiclient.discovery import build
                from google.oauth2.credentials import Credentials
                def _fetch_label_names():
                    svc = build("gmail", "v1", credentials=Credentials(token=token))
                    return {l["id"]: l["name"] for l in svc.users().labels().list(userId="me").execute().get("labels", [])}
                id_to_name = await _asyncio.to_thread(_fetch_label_names)
                for email in emails:
                    vega_cats = []
                    for lid in email.get("labels", []):
                        label_name = id_to_name.get(lid, "")
                        lower_name = label_name.lower()
                        if lower_name in managed_label_names:
                            vega_cats.append(_normalize_label(label_name, label_definitions))
                        elif lower_name.startswith("vega/") and lower_name[5:] in managed_label_names:
                            vega_cats.append(_normalize_label(label_name[5:], label_definitions))
                    # Prefer most specific label — skip "Other" if a better one exists
                    primary = next(
                        (c for c in vega_cats if c.lower() != "other"),
                        vega_cats[0] if vega_cats else None,
                    )
                    if primary:
                        email_by_label[primary] = email_by_label.get(primary, 0) + 1
            except Exception:
                pass

    events = []
    if request.include_calendar:
        events = await list_events(token, days_ahead=7)

    # Best-effort Rex financial snapshot
    financial_snapshot = ""
    try:
        from agents.registry import get_agent
        from core.models import ChatRequest as _ChatRequest
        rex = get_agent("rex")
        if rex:
            snap = await rex.chat_sync(_ChatRequest(
                user_id=request.user_id,
                organization_id=request.organization_id,
                conversation_id="vega-briefing-rex-snapshot",
                message="Give me today's financial snapshot in 2 sentences: headline metric, runway status, and one alert if any. Be brief.",
                history=[],
                metadata={"_cross_agent_call": True},
            ))
            if snap.response:
                financial_snapshot = snap.response
    except Exception:
        pass

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    total_unread = len(emails)
    context = (
        f"Total unread emails today: {total_unread}\n"
        f"Unread emails (up to 10): {json.dumps(emails[:10])}\n\n"
        f"Calendar events: {json.dumps(events)}"
    )
    if financial_snapshot:
        context += f"\n\nFinancial status (from Rex): {financial_snapshot}"

    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Generate an executive briefing for today:\n{context}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "date, urgent_actions (list of {action, deadline, context, email_id?}), "
            "today_schedule (list of {time, event, location?, prep_needed}), "
            "email_priorities (list of {id, priority: urgent|high|medium|low} — classify EACH email in the sample individually, one entry per email), "
            "financial_status (string), "
            "focus_recommendation (string)"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
    except Exception:
        data = {"briefing_text": raw}

    # Compute email_summary from per-email classifications — consistent, not re-invented
    from collections import Counter as _Counter
    ep_list = data.pop("email_priorities", [])
    p_counts = _Counter(ep.get("priority", "medium") for ep in ep_list if isinstance(ep, dict))
    data["email_summary"] = {
        "total_unread": total_unread,
        "urgent": p_counts.get("urgent", 0),
        "high": p_counts.get("high", 0),
        "medium": p_counts.get("medium", 0) or max(0, total_unread - p_counts.get("urgent", 0) - p_counts.get("high", 0) - p_counts.get("low", 0)),
        "low": p_counts.get("low", 0),
    }
    data["email_by_label"] = email_by_label
    data["generated_at"] = datetime.utcnow().isoformat()
    if financial_snapshot and "financial_status" not in data:
        data["financial_status"] = financial_snapshot
    return ExecutiveBriefingResponse(briefing=data, tokens_used=tokens_used, model_used=_agent.default_model)


@router.post("/compose-email", response_model=ComposeEmailResponse, summary="Compose new outbound email")
async def compose_email(request: ComposeEmailRequest) -> ComposeEmailResponse:
    """Draft a brand new outbound email. Returns node_action for backend to create Gmail draft."""
    if settings.MOCK_MODE:
        body = (
            f"Hi,\n\nI hope this message finds you well.\n\n"
            f"{request.instructions[:200]}\n\n"
            "I'd love to connect and discuss further. Would you be available for a 30-minute call this week?\n\n"
            "Best regards,\nFounder, Veqiro AI"
        )
        node_action = {
            "node_action": "create_gmail_draft",
            "to": request.to,
            "subject": request.subject,
            "body": body,
            "reply_to_message_id": None,
            "reply_to_thread_id": None,
        }
        return ComposeEmailResponse(
            draft={"to": request.to, "subject": request.subject, "body": body},
            node_actions=[node_action],
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Compose a {request.tone} email.\n\n"
            f"To: {request.to}\nSubject: {request.subject}\n"
            f"Instructions: {request.instructions}\n"
            f"{'Include a clear call-to-action.' if request.include_cta else 'No CTA needed.'}"
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    node_action = {
        "node_action": "create_gmail_draft",
        "to": request.to,
        "subject": request.subject,
        "body": raw,
        "reply_to_message_id": None,
        "reply_to_thread_id": None,
    }
    return ComposeEmailResponse(
        draft={"to": request.to, "subject": request.subject, "body": raw},
        node_actions=[node_action],
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


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
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
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
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
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

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
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
