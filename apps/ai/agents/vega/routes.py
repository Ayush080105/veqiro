import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.vega.agent import VegaAgent
from agents.vega.gmail import list_unread, get_message, create_draft, create_label, label_message
from agents.vega.calendar import list_events, create_event, find_free_slots

router = APIRouter(prefix="/ai/vega", tags=["Vega"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = VegaAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class ProcessInboxRequest(BaseModel):
    user_id: str
    google_access_token: str | None = None
    max_emails: int = 20
    auto_label: bool = True
    draft_replies: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "google_access_token": None,
                "max_emails": 10,
                "auto_label": True,
                "draft_replies": True,
            }
        }
    )


class ProcessedEmail(BaseModel):
    email_id: str
    subject: str
    from_name: str
    priority: str
    summary: str
    suggested_action: str
    label_applied: str | None = None
    draft_created: bool = False
    draft_id: str | None = None


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


class DraftReplyRequest(BaseModel):
    user_id: str
    google_access_token: str | None = None
    email_id: str
    reply_instructions: str
    tone: str = "professional"
    save_as_draft: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "google_access_token": None,
                "email_id": "msg_001",
                "reply_instructions": "Accept the meeting, propose Thursday 3pm EST, attach our metrics deck",
                "tone": "professional and enthusiastic",
                "save_as_draft": True,
            }
        }
    )


class DraftReplyResponse(BaseModel):
    draft: dict
    suggested_follow_up: str


class CalendarSummaryRequest(BaseModel):
    user_id: str
    google_access_token: str | None = None
    days_ahead: int = 7

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "google_access_token": None,
                "days_ahead": 7,
            }
        }
    )


class CalendarSummaryResponse(BaseModel):
    events: list[dict]
    conflicts: list[dict]
    free_slots: list[dict]
    daily_summary: dict


class CreateEventRequest(BaseModel):
    user_id: str
    google_access_token: str | None = None
    description: str
    check_conflicts: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "google_access_token": None,
                "description": "Schedule a 30-minute call with Marcus Rivera from GrowthCo on Wednesday April 2nd at 10am EST",
                "check_conflicts": True,
            }
        }
    )


class CreateEventResponse(BaseModel):
    event: dict
    conflicts: list[dict]
    google_event_id: str
    created: bool


class ExecutiveBriefingRequest(BaseModel):
    user_id: str
    google_access_token: str | None = None
    include_email: bool = True
    include_calendar: bool = True

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "google_access_token": None,
                "include_email": True,
                "include_calendar": True,
            }
        }
    )


class ExecutiveBriefingResponse(BaseModel):
    briefing: dict


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Vega chat")
async def vega_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Vega's executive assistant response as a standard JSON response."""
    return await _agent.chat_sync(request)


@router.post("/process-inbox", response_model=ProcessInboxResponse, summary="Process email inbox")
async def process_inbox(request: ProcessInboxRequest) -> ProcessInboxResponse:
    """Triage, label, and draft replies for unread emails."""
    token = request.google_access_token or "mock-token"
    emails = await list_unread(token, max_results=request.max_emails)

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
        return ProcessInboxResponse(processed=processed, stats=stats)

    system = await _agent.build_system_prompt(request.user_id)
    processed = []
    stats_counts = {"urgent": 0, "high": 0, "medium": 0, "low": 0}
    drafts = 0
    labels = 0

    for email in emails[:request.max_emails]:
        import json
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": f"Analyze this email and determine priority (urgent/high/medium/low), summary, and suggested action:\n\nFrom: {email.get('from', '')}\nSubject: {email.get('subject', '')}\nBody: {email.get('body', email.get('snippet', ''))[:500]}"}],
        )
        priority = email.get("priority", "medium")
        stats_counts[priority] = stats_counts.get(priority, 0) + 1
        processed.append(ProcessedEmail(
            email_id=email["id"],
            subject=email.get("subject", ""),
            from_name=email.get("from_name", email.get("from", "")),
            priority=priority,
            summary=raw[:300],
            suggested_action=email.get("suggested_action", "review"),
        ))

    stats = InboxStats(
        total_processed=len(processed),
        **stats_counts,
        drafts_created=drafts,
        labels_applied=labels,
    )
    return ProcessInboxResponse(processed=processed, stats=stats)


@router.post("/draft-reply", response_model=DraftReplyResponse, summary="Draft email reply")
async def draft_reply(request: DraftReplyRequest) -> DraftReplyResponse:
    """Draft a contextually appropriate email reply."""
    token = request.google_access_token or "mock-token"

    if settings.MOCK_MODE:
        return DraftReplyResponse(
            draft={
                "to": "sarah.chen@accelpartners.com",
                "subject": "RE: Veqiro AI – Seed Round Interest",
                "body": (
                    "Hi Sarah,\n\nThank you so much for following up – and it was great meeting you at Disrupt!\n\n"
                    "Thursday at 3pm EST works perfectly for me. I'll send a calendar invite momentarily.\n\n"
                    "I'll attach our latest metrics deck to this email – happy to walk you through the numbers live, "
                    "but wanted to give you a head start.\n\n"
                    "Quick highlights: MRR hit $58K last month (39% MoM growth), churn is tracking at 2.1%, "
                    "and we have 248 active subscribers with strong expansion revenue.\n\n"
                    "Looking forward to the conversation!\n\n"
                    "Best,\nAlex\nFounder & CEO, Veqiro AI\n+1 (415) 555-0123"
                ),
                "draft_id": "draft_001_mock",
                "saved": request.save_as_draft,
            },
            suggested_follow_up="Follow up Friday April 4th if no confirmation received by Thursday morning",
        )

    email = await get_message(token, request.email_id)
    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Draft a {request.tone} reply to this email:\n\nFrom: {email.get('from', '')}\nSubject: {email.get('subject', '')}\nBody: {email.get('body', '')[:1000]}\n\nInstructions: {request.reply_instructions}"}],
    )
    draft_id = None
    if request.save_as_draft:
        draft_id = await create_draft(token, email.get("from", ""), f"RE: {email.get('subject', '')}", raw)

    return DraftReplyResponse(
        draft={"to": email.get("from", ""), "subject": f"RE: {email.get('subject', '')}", "body": raw, "draft_id": draft_id, "saved": request.save_as_draft},
        suggested_follow_up="Follow up in 48 hours if no response",
    )


@router.post("/calendar-summary", response_model=CalendarSummaryResponse, summary="Summarize calendar")
async def calendar_summary(request: CalendarSummaryRequest) -> CalendarSummaryResponse:
    """Get a comprehensive calendar overview with conflict detection and free slots."""
    token = request.google_access_token or "mock-token"
    events = await list_events(token, days_ahead=request.days_ahead)
    free_slots = await find_free_slots(token, {})

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

    return CalendarSummaryResponse(
        events=events,
        conflicts=[],
        free_slots=free_slots,
        daily_summary={},
    )


@router.post("/create-event", response_model=CreateEventResponse, summary="Create calendar event")
async def create_calendar_event(request: CreateEventRequest) -> CreateEventResponse:
    """Parse natural language description and create a calendar event."""
    token = request.google_access_token or "mock-token"

    if settings.MOCK_MODE:
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
        )

    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Parse this event description into structured data:\n{request.description}\n\nReturn JSON with fields: title, start (ISO datetime), end (ISO datetime), attendees (list of emails), description"}],
    )
    try:
        event_data = json.loads(raw)
    except Exception:
        event_data = {"title": request.description[:50], "start": "2025-04-01T10:00:00Z", "end": "2025-04-01T11:00:00Z", "attendees": []}

    conflicts = []
    if request.check_conflicts:
        existing = await list_events(token, days_ahead=14)
        for e in existing:
            if e.get("start", "")[:10] == event_data.get("start", "")[:10]:
                conflicts.append({"event": e.get("title", ""), "time": e.get("start", "")})

    created_event = await create_event(token, event_data)
    return CreateEventResponse(
        event=created_event,
        conflicts=conflicts,
        google_event_id=created_event.get("id", ""),
        created=True,
    )


@router.post("/executive-briefing", response_model=ExecutiveBriefingResponse, summary="Executive daily briefing")
async def executive_briefing(request: ExecutiveBriefingRequest) -> ExecutiveBriefingResponse:
    """Generate a comprehensive executive briefing combining email, calendar, and context."""
    token = request.google_access_token or "mock-token"

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
                "free_time_today": "10am-5pm EST (7.5 hours)",
                "focus_recommendation": "Block 10am-12pm for deep work. Do investor reply before standup.",
                "generated_at": datetime.utcnow().isoformat(),
            }
        )

    emails = []
    if request.include_email:
        emails = await list_unread(token, max_results=10)
    events = []
    if request.include_calendar:
        events = await list_events(token, days_ahead=7)

    system = await _agent.build_system_prompt(request.user_id)
    import json
    context = f"Unread emails: {json.dumps(emails[:5])}\n\nCalendar events: {json.dumps(events)}"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Generate an executive briefing for today:\n{context}"}],
    )
    return ExecutiveBriefingResponse(
        briefing={"narrative": raw, "generated_at": datetime.utcnow().isoformat()}
    )
