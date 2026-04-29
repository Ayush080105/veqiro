import asyncio
import json
from datetime import datetime, timedelta, timezone

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter
from core.utils import strip_json_fences, safe_json_loads


class VegaAgent(BaseAgent):
    slug = "vega"
    name = "Vega"
    personality = (
        "the executive assistant who actually keeps things moving. "
        "You manage the founder's inbox, calendar, and communications without making it a big deal. "
        "You draft things that sound like them, flag what actually needs their attention, "
        "and handle the rest. Calm, on top of it, no drama."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)
        self._node_actions_buffer: list[dict] = []
        self._google_token: str = ""

    # ── Tool-use instructions ────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## MANDATORY Tool Usage Rules\n"
            "You MUST use tools for ANY email, calendar, or scheduling task — "
            "never compose emails or schedule events as plain text without calling a tool.\n"
            "- Any request to process, triage, or summarize emails → call `process_inbox`\n"
            "- Any request to reply to an email → call `draft_reply`\n"
            "- Any request to write a new email → call `compose_email`\n"
            "- Any request about calendar, schedule, or meetings → call `calendar_summary`\n"
            "- Any request to schedule or create an event → call `create_event`\n"
            "- Any request for a daily briefing → call `executive_briefing`\n"
            "IMPORTANT: You do NOT send emails or create calendar events directly. "
            "Your tools return structured action instructions (node_actions) that the system backend executes. "
            "Always present the drafted content to the user for review before confirming.\n\n"
            "## When to use ask_agent\n"
            "- User asks to include financial metrics or runway data in a briefing or email → call `ask_agent` with rex first.\n"
            "- User wants to research an attendee or company before a meeting → call `ask_agent` with scout.\n"
            "- User wants you to review a contract or legal clause from an email → call `ask_agent` with lex.\n"
            "- User wants social content drafted (e.g. for a newsletter) → call `ask_agent` with maya."
        )

    # ── System prompt ────────────────────────────────────────────────────

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
    ) -> str:
        base = await super().build_system_prompt(user_id, organization_id, extra_context)

        client_ctx = ""
        if use_brand_kit:
            from core.brand_kit import load_brand_kit, get_site_context_block
            brand_kit = await load_brand_kit(organization_id)
            client_ctx = "\n\n## Client Context\n"
            client_ctx += f"Company: **{brand_kit.company_name}**\n"
            if brand_kit.industry:
                client_ctx += f"Industry: {brand_kit.industry}\n"
            if brand_kit.brand_voice:
                client_ctx += f"Brand Voice: {brand_kit.brand_voice}\n"
            if brand_kit.website_url:
                client_ctx += f"Website: {brand_kit.website_url}\n"
            platform_tones = brand_kit.platform_tones or {}
            if any(platform_tones.values()):
                tones_str = ", ".join(
                    f"{k}: {v}" for k, v in platform_tones.items() if v
                )
                client_ctx += f"Platform Tones: {tones_str}\n"
            site_block = get_site_context_block(brand_kit)
            if site_block:
                client_ctx += "\n" + site_block + "\n"

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
        return base + client_ctx + vega_specific

    # ── Chat override: collect node_actions from tool calls ──────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        self._node_actions_buffer = []
        self._google_token = request.metadata.get("google_access_token", "")

        response = await super().chat_sync(request)

        # Inject any node_actions accumulated during execute_tool() calls
        if self._node_actions_buffer:
            response.metadata["node_actions"] = list(self._node_actions_buffer)
            self._node_actions_buffer = []

        return response

    # ── Tool Definitions ─────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="process_inbox",
                description="Triage, prioritize, and label unread emails. Returns processed emails with priority levels, summaries, and node_action instructions for the backend to apply labels.",
                parameters=[
                    ToolParameter(name="max_emails", type="integer", description="Maximum number of emails to process", required=False, default=10),
                    ToolParameter(name="auto_label", type="boolean", description="Whether to auto-label emails", required=False, default=True),
                    ToolParameter(name="draft_replies", type="boolean", description="Whether to draft replies for important emails", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="draft_reply",
                description="Draft a contextually appropriate email reply in the founder's voice. Returns a node_action for the backend to create the Gmail draft.",
                parameters=[
                    ToolParameter(name="email_id", type="string", description="ID of the email to reply to", required=True),
                    ToolParameter(name="reply_instructions", type="string", description="Instructions for the reply (e.g., 'Accept the meeting, propose Thursday 3pm')", required=True),
                    ToolParameter(name="tone", type="string", description="Tone of the reply", required=False, default="professional"),
                    ToolParameter(name="save_as_draft", type="boolean", description="Whether to save as Gmail draft", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="calendar_summary",
                description="Get a comprehensive calendar overview with events, conflict detection, free slots, and daily summaries.",
                parameters=[
                    ToolParameter(name="days_ahead", type="integer", description="Number of days to look ahead", required=False, default=7),
                ],
            ),
            ToolDefinition(
                name="create_event",
                description="Parse a natural language event description and return a node_action for the backend to create the calendar event. Checks for conflicts with existing events.",
                parameters=[
                    ToolParameter(name="description", type="string", description="Natural language event description (e.g., 'Schedule a 30-min call with Marcus on Wednesday at 10am')", required=True),
                    ToolParameter(name="check_conflicts", type="boolean", description="Whether to check for scheduling conflicts", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="executive_briefing",
                description="Generate a comprehensive executive daily briefing combining email summaries, calendar overview, urgent actions, and focus recommendations.",
                parameters=[
                    ToolParameter(name="include_email", type="boolean", description="Include email summary in briefing", required=False, default=True),
                    ToolParameter(name="include_calendar", type="boolean", description="Include calendar summary in briefing", required=False, default=True),
                ],
            ),
            ToolDefinition(
                name="compose_email",
                description="Draft a brand new outbound email (not a reply). Returns a node_action for the backend to create a Gmail draft.",
                parameters=[
                    ToolParameter(name="to", type="string", description="Recipient email address or name", required=True),
                    ToolParameter(name="subject", type="string", description="Email subject line", required=True),
                    ToolParameter(name="instructions", type="string", description="Instructions for what the email should say and achieve", required=True),
                    ToolParameter(name="tone", type="string", description="Tone of the email (professional, casual, enthusiastic)", required=False, default="professional"),
                    ToolParameter(name="include_cta", type="boolean", description="Whether to include a clear call-to-action", required=False, default=True),
                ],
            ),
        ]

    # ── Tool Execution ────────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        # Read-only Gmail/Calendar access for context; all writes become node_actions
        from agents.vega.gmail import list_unread, get_message
        from agents.vega.calendar import list_events, find_free_slots

        system = await self.build_system_prompt(user_id, organization_id)
        token = self._google_token or "mock-token"

        if name == "process_inbox":
            max_emails = arguments.get("max_emails", 10)
            emails = await list_unread(token, max_results=max_emails)

            processed = []
            label_messages = []

            for email in emails[:max_emails]:
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        "Analyze this email. Return ONLY a JSON object (no markdown fences) with keys:\n"
                        "priority (urgent/high/medium/low), summary (1-2 sentences), "
                        "suggested_action (string), label (one of: Investors, Sales Leads, "
                        "Newsletters, Team, Legal, Finance, Other), "
                        "hidden_tasks (list of strings — implicit action items, e.g. 'review attached deck', 'respond before Friday'), "
                        "suggested_reply (string — a 1-3 sentence reply suggestion if suggested_action is 'reply', otherwise null), "
                        "meeting_request (object with keys date, time, topic if the email requests a meeting, otherwise null)\n\n"
                        f"From: {email.get('from', '')}\n"
                        f"Subject: {email.get('subject', '')}\n"
                        f"Body: {email.get('body', email.get('snippet', ''))[:500]}"
                    )}],
                )
                try:
                    analysis = safe_json_loads(raw)
                    priority = analysis.get("priority", "medium")
                    summary = analysis.get("summary", raw[:200])
                    suggested_action = analysis.get("suggested_action", "review")
                    label = analysis.get("label", "Other")
                    hidden_tasks = analysis.get("hidden_tasks", [])
                    suggested_reply = analysis.get("suggested_reply", None)
                    meeting_request = analysis.get("meeting_request", None)
                except Exception:
                    priority = "medium"
                    summary = raw[:200]
                    suggested_action = "review"
                    label = "Other"
                    hidden_tasks = []
                    suggested_reply = None
                    meeting_request = None

                label_messages.append({"email_id": email.get("id", ""), "label": label})
                processed.append({
                    "email_id": email.get("id", ""),
                    "subject": email.get("subject", ""),
                    "from": email.get("from_name", email.get("from", "")),
                    "from_email": email.get("from_email", ""),
                    "priority": priority,
                    "summary": summary,
                    "suggested_action": suggested_action,
                    "label": label,
                    "hidden_tasks": hidden_tasks,
                    "suggested_reply": suggested_reply,
                    "meeting_request": meeting_request,
                })

            node_action = {
                "node_action": "label_messages",
                "messages": label_messages,
            }
            self._node_actions_buffer.append(node_action)
            result = {
                "processed": processed,
                "total": len(processed),
                "node_action": node_action,
            }
            return json.dumps(result, default=str)

        elif name == "draft_reply":
            email_id = arguments.get("email_id", "")
            instructions = arguments.get("reply_instructions", "")
            tone = arguments.get("tone", "professional")

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

            node_action = {
                "node_action": "create_gmail_draft",
                "to": email.get("from", ""),
                "subject": f"RE: {email.get('subject', '')}",
                "body": raw,
                "reply_to_message_id": email_id,
                "reply_to_thread_id": email.get("thread_id", ""),
            }
            self._node_actions_buffer.append(node_action)
            result = {
                "to": email.get("from", ""),
                "subject": f"RE: {email.get('subject', '')}",
                "body": raw,
                "node_action": node_action,
            }
            return json.dumps(result, default=str)

        elif name == "calendar_summary":
            days = arguments.get("days_ahead", 7)
            events = await list_events(token, days_ahead=days)
            free_slots = await find_free_slots(token, {})

            # Detect overlapping events
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

            result = {
                "events": events,
                "conflicts": conflicts,
                "free_slots": free_slots,
                "total_events": len(events),
                "total_conflicts": len(conflicts),
            }
            return json.dumps(result, default=str)

        elif name == "create_event":
            description = arguments.get("description", "")
            check_conflicts = arguments.get("check_conflicts", True)

            now = datetime.now(timezone.utc)
            next_day = (now + timedelta(days=1)).strftime("%Y-%m-%d")

            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Today is {now.strftime('%A, %Y-%m-%d')} UTC.\n"
                    f"Parse this event description into structured data:\n{description}\n\n"
                    "Return ONLY a JSON object (no markdown fences) with keys: "
                    "title (string), start (ISO 8601 UTC datetime), end (ISO 8601 UTC datetime), "
                    "attendees (list of email strings), description (string)"
                )}],
            )
            try:
                event_data = safe_json_loads(raw)
            except Exception:
                event_data = {
                    "title": description[:50],
                    "start": f"{next_day}T10:00:00Z",
                    "end": f"{next_day}T11:00:00Z",
                    "attendees": [],
                    "description": description,
                }

            conflicts = []
            if check_conflicts:
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
            self._node_actions_buffer.append(node_action)
            result = {
                "event": event_data,
                "conflicts": conflicts,
                "node_action": node_action,
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

            context = (
                f"Unread emails: {json.dumps(emails[:5], default=str)}\n\n"
                f"Calendar events: {json.dumps(events, default=str)}"
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Generate a comprehensive executive briefing for today:\n{context}\n\n"
                    "Return ONLY a JSON object (no markdown fences) with keys:\n"
                    "date (string), urgent_actions (list of {action, deadline, context, email_id?}), "
                    "today_schedule (list of {time, event, location?, prep_needed}), "
                    "email_summary ({total_unread, urgent, high, medium, low}), "
                    "focus_recommendation (string)"
                )}],
            )
            try:
                data = safe_json_loads(raw)
            except Exception:
                data = {"briefing_text": raw}
            data["generated_at"] = datetime.utcnow().isoformat()
            return json.dumps(data, default=str)

        elif name == "compose_email":
            to = arguments.get("to", "")
            subject = arguments.get("subject", "")
            instructions = arguments.get("instructions", "")
            tone = arguments.get("tone", "professional")
            include_cta = arguments.get("include_cta", True)

            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Compose a {tone} email.\n\n"
                    f"To: {to}\nSubject: {subject}\n"
                    f"Instructions: {instructions}\n"
                    f"{'Include a clear call-to-action.' if include_cta else 'No CTA needed.'}"
                )}],
            )

            node_action = {
                "node_action": "create_gmail_draft",
                "to": to,
                "subject": subject,
                "body": raw,
                "reply_to_message_id": None,
                "reply_to_thread_id": None,
            }
            self._node_actions_buffer.append(node_action)
            result = {
                "to": to,
                "subject": subject,
                "body": raw,
                "node_action": node_action,
            }
            return json.dumps(result, default=str)

        raise ValueError(f"Unknown tool: {name}")
