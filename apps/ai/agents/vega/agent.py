import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter


class VegaAgent(BaseAgent):
    slug = "vega"
    name = "Vega"
    personality = (
        "Hyper-efficient executive assistant who manages communication, scheduling, and coordination "
        "with precision and proactivity. You prioritize ruthlessly, draft communications that sound "
        "exactly like the founder, and ensure nothing falls through the cracks. You're the difference "
        "between a founder who's reactive and one who's always ahead."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        vega_specific = (
            "\n\nAs Vega, you specialize in:\n"
            "- Email management: triage, prioritization, drafting replies in the founder's voice\n"
            "- Calendar optimization: scheduling, conflict detection, preparation reminders\n"
            "- Executive briefings: daily digest combining email, calendar, and key metrics\n"
            "- Communication: drafting investor updates, team announcements, follow-up sequences\n\n"
            "Executive assistant principles:\n"
            "1. Prioritize by impact – investor and customer emails always first\n"
            "2. Draft replies that match the founder's voice, not generic templates\n"
            "3. Flag anything that needs decision-making vs. can be handled automatically\n"
            "4. Always suggest follow-up dates for any commitment made\n"
            "5. Surface conflicts and scheduling issues proactively\n"
        )
        return base + vega_specific

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="process_inbox",
                description="Triage, prioritize, and optionally label unread emails. Returns processed emails with priority levels, summaries, and suggested actions.",
                parameters=[
                    ToolParameter(name="google_access_token", type="string", description="Google OAuth access token for Gmail API", required=False),
                    ToolParameter(name="max_emails", type="integer", description="Maximum number of emails to process", required=False, default=10),
                    ToolParameter(name="auto_label", type="boolean", description="Whether to auto-label emails", required=False, default=True),
                    ToolParameter(name="draft_replies", type="boolean", description="Whether to draft replies for important emails", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="draft_reply",
                description="Draft a contextually appropriate email reply in the founder's voice.",
                parameters=[
                    ToolParameter(name="google_access_token", type="string", description="Google OAuth access token", required=False),
                    ToolParameter(name="email_id", type="string", description="ID of the email to reply to", required=True),
                    ToolParameter(name="reply_instructions", type="string", description="Instructions for the reply (e.g., 'Accept the meeting, propose Thursday 3pm')", required=True),
                    ToolParameter(name="tone", type="string", description="Tone of the reply", required=False, default="professional"),
                    ToolParameter(name="save_as_draft", type="boolean", description="Whether to save as Gmail draft", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="calendar_summary",
                description="Get a comprehensive calendar overview with events, conflicts, free slots, and daily summaries.",
                parameters=[
                    ToolParameter(name="google_access_token", type="string", description="Google OAuth access token", required=False),
                    ToolParameter(name="days_ahead", type="integer", description="Number of days to look ahead", required=False, default=7),
                ],
            ),
            ToolDefinition(
                name="create_event",
                description="Parse a natural language event description and create a calendar event. Checks for conflicts with existing events.",
                parameters=[
                    ToolParameter(name="google_access_token", type="string", description="Google OAuth access token", required=False),
                    ToolParameter(name="description", type="string", description="Natural language event description (e.g., 'Schedule a 30-min call with Marcus on Wednesday at 10am')", required=True),
                    ToolParameter(name="check_conflicts", type="boolean", description="Whether to check for scheduling conflicts", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="executive_briefing",
                description="Generate a comprehensive executive daily briefing combining email summaries, calendar overview, urgent actions, and focus recommendations.",
                parameters=[
                    ToolParameter(name="google_access_token", type="string", description="Google OAuth access token", required=False),
                    ToolParameter(name="include_email", type="boolean", description="Include email summary in briefing", required=False, default=True),
                    ToolParameter(name="include_calendar", type="boolean", description="Include calendar summary in briefing", required=False, default=True),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        from agents.vega.gmail import list_unread, get_message, create_draft, label_message
        from agents.vega.calendar import list_events, create_event, find_free_slots

        system = await self.build_system_prompt(user_id)
        token = arguments.get("google_access_token") or "mock-token"

        if name == "process_inbox":
            max_emails = arguments.get("max_emails", 10)
            emails = await list_unread(token, max_results=max_emails)

            processed = []
            for email in emails[:max_emails]:
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Analyze this email and determine priority (urgent/high/medium/low), "
                        f"summary, and suggested action:\n\n"
                        f"From: {email.get('from', '')}\n"
                        f"Subject: {email.get('subject', '')}\n"
                        f"Body: {email.get('body', email.get('snippet', ''))[:500]}"
                    )}],
                )
                processed.append({
                    "email_id": email.get("id", ""),
                    "subject": email.get("subject", ""),
                    "from": email.get("from_name", email.get("from", "")),
                    "analysis": raw,
                })
            return json.dumps({"processed": processed, "total": len(processed)}, default=str)

        elif name == "draft_reply":
            email_id = arguments.get("email_id", "")
            instructions = arguments.get("reply_instructions", "")
            tone = arguments.get("tone", "professional")
            save = arguments.get("save_as_draft", True)

            email = await get_message(token, email_id)
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Draft a {tone} reply to this email:\n\n"
                    f"From: {email.get('from', '')}\n"
                    f"Subject: {email.get('subject', '')}\n"
                    f"Body: {email.get('body', '')[:1000]}\n\n"
                    f"Instructions: {instructions}"
                )}],
            )

            draft_id = None
            if save:
                draft_id = await create_draft(
                    token, email.get("from", ""),
                    f"RE: {email.get('subject', '')}", raw
                )

            result = {
                "to": email.get("from", ""),
                "subject": f"RE: {email.get('subject', '')}",
                "body": raw,
                "draft_id": draft_id,
                "saved": save,
            }
            return json.dumps(result, default=str)

        elif name == "calendar_summary":
            days = arguments.get("days_ahead", 7)
            events = await list_events(token, days_ahead=days)
            free_slots = await find_free_slots(token, {})

            result = {
                "events": events,
                "free_slots": free_slots,
                "total_events": len(events),
            }
            return json.dumps(result, default=str)

        elif name == "create_event":
            description = arguments.get("description", "")
            check_conflicts = arguments.get("check_conflicts", True)

            # Parse natural language into structured event data
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Parse this event description into structured data:\n{description}\n\n"
                    "Return JSON with: title, start (ISO datetime), end (ISO datetime), "
                    "attendees (list of emails), description"
                )}],
            )
            try:
                event_data = json.loads(raw)
            except Exception:
                event_data = {
                    "title": description[:50],
                    "start": "2025-04-01T10:00:00Z",
                    "end": "2025-04-01T11:00:00Z",
                    "attendees": [],
                }

            conflicts = []
            if check_conflicts:
                existing = await list_events(token, days_ahead=14)
                for e in existing:
                    if e.get("start", "")[:10] == event_data.get("start", "")[:10]:
                        conflicts.append({"event": e.get("title", ""), "time": e.get("start", "")})

            created = await create_event(token, event_data)
            result = {
                "event": created,
                "conflicts": conflicts,
                "created": True,
            }
            return json.dumps(result, default=str)

        elif name == "executive_briefing":
            include_email = arguments.get("include_email", True)
            include_calendar = arguments.get("include_calendar", True)

            emails = []
            if include_email:
                emails = await list_unread(token, max_results=10)
            events = []
            if include_calendar:
                events = await list_events(token, days_ahead=7)

            context = f"Unread emails: {json.dumps(emails[:5], default=str)}\n\nCalendar events: {json.dumps(events, default=str)}"
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Generate a comprehensive executive briefing for today:\n{context}"}],
            )
            return raw

        raise ValueError(f"Unknown tool: {name}")
