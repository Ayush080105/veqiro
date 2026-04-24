import json
import asyncio
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.config import settings
from core.utils import safe_json_loads

router = APIRouter(prefix="/ai", tags=["Briefing"])

_llm = LLMClient()

_AGENT_META = {
    "maya": "Content creation & social media — generates posts, captions, newsletters, and marketing copy",
    "rex": "Financial analytics & forecasting — analyzes metrics, builds forecasts, and computes financial health",
    "scout": "Market research & competitive intelligence — researches companies, trends, and competitors",
    "sage": "SEO & content strategy — keyword research, SEO blog generation, and content briefs",
    "lex": "Legal & compliance — contract analysis, document drafting, and legal research",
    "vega": "Executive assistant — email triage, reply drafting, calendar management, and daily briefings",
}


# ── Models ────────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str    # "user" | "assistant"
    content: str


class BriefingRequest(BaseModel):
    user_id: str
    date: str = ""   # ISO date string; defaults to today
    conversations: dict[str, list[Message]]  # agent_slug -> full message history

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "date": "2026-04-24",
                "conversations": {
                    "maya": [
                        {"role": "user", "content": "Write a LinkedIn post about our Series A"},
                        {"role": "assistant", "content": "Here's a LinkedIn post..."},
                    ],
                    "rex": [],
                    "scout": [],
                    "sage": [],
                    "lex": [
                        {"role": "user", "content": "Analyze this NDA — source_id doc_abc123"},
                        {"role": "assistant", "content": "Analysis complete. Risk level: medium..."},
                    ],
                    "vega": [],
                },
            }
        }
    )


class AgentBriefing(BaseModel):
    active: bool
    message_count: int
    summary: str
    actions_taken: list[str]
    key_outputs: list[str]
    metrics: dict                # agent-specific quantitative metrics extracted from conversation
    follow_ups: list[str]


class DailyBriefing(BaseModel):
    date: str
    user_id: str
    overall_summary: str
    agents_active: list[str]
    agents_breakdown: dict[str, AgentBriefing]
    growth_highlights: list[str]
    key_decisions: list[str]
    pending_actions: list[str]
    tokens_used: int = 0
    model_used: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_conversation(messages: list[Message], char_limit: int = 6000) -> str:
    lines = []
    for m in messages:
        lines.append(f"{m.role.upper()}: {m.content}")
    text = "\n".join(lines)
    return text[:char_limit] + ("\n...[truncated]" if len(text) > char_limit else "")


async def _extract_agent_briefing(slug: str, messages: list[Message]) -> tuple[str, AgentBriefing, int]:
    """Run one LLM call to extract structured briefing for a single agent. Returns (slug, briefing, tokens)."""
    if not messages:
        return slug, AgentBriefing(
            active=False, message_count=0, summary="No activity today.",
            actions_taken=[], key_outputs=[], metrics={}, follow_ups=[],
        ), 0

    conversation_text = _format_conversation(messages)
    description = _AGENT_META.get(slug, slug)

    prompt = (
        f"You are analyzing a conversation between a startup founder and the '{slug}' AI agent.\n"
        f"Agent role: {description}\n\n"
        "Extract a structured summary of what was accomplished in this conversation.\n\n"
        "Return ONLY a JSON object (no markdown fences) with exactly these keys:\n"
        "summary (string — 2-3 sentences of what was done), "
        "actions_taken (list of strings — specific tasks performed), "
        "key_outputs (list of strings — results, content created, documents produced, insights found), "
        "metrics (dict — any quantitative metrics mentioned or implied, e.g. posts_created, contracts_reviewed, leads_found, revenue_analyzed), "
        "follow_ups (list of strings — pending items or next steps mentioned)\n\n"
        f"Conversation:\n{conversation_text}"
    )

    raw = await _llm.complete(
        provider="openai", model="gpt-4o-mini",
        system="You are a precise summarization engine. Extract structured data from AI agent conversations.",
        messages=[{"role": "user", "content": prompt}],
    )
    tokens = _llm.count_tokens(raw)

    try:
        data = safe_json_loads(raw)
        briefing = AgentBriefing(
            active=True,
            message_count=len(messages),
            summary=data.get("summary", ""),
            actions_taken=data.get("actions_taken", []),
            key_outputs=data.get("key_outputs", []),
            metrics=data.get("metrics", {}),
            follow_ups=data.get("follow_ups", []),
        )
    except Exception:
        briefing = AgentBriefing(
            active=True,
            message_count=len(messages),
            summary=raw[:300],
            actions_taken=[], key_outputs=[], metrics={}, follow_ups=[],
        )

    return slug, briefing, tokens


async def _synthesize_briefing(
    agent_summaries: dict[str, AgentBriefing],
    date: str,
) -> tuple[str, list[str], list[str], list[str], int]:
    """One synthesis LLM call across all agent summaries. Returns (overall_summary, highlights, decisions, pending, tokens)."""
    summary_lines = []
    for slug, b in agent_summaries.items():
        if b.active:
            summary_lines.append(
                f"[{slug.upper()}] {b.summary}\n"
                f"  Actions: {', '.join(b.actions_taken) or 'none'}\n"
                f"  Metrics: {json.dumps(b.metrics) if b.metrics else 'none'}\n"
                f"  Follow-ups: {', '.join(b.follow_ups) or 'none'}"
            )

    if not summary_lines:
        return "No agent activity recorded today.", [], [], [], 0

    context = "\n\n".join(summary_lines)
    prompt = (
        f"You are generating an executive daily briefing for a startup founder. Date: {date}\n\n"
        "Below are summaries from AI agents showing what was accomplished today:\n\n"
        f"{context}\n\n"
        "Return ONLY a JSON object (no markdown fences) with exactly these keys:\n"
        "overall_summary (string — 3-4 sentence synthesis of the full day across all agents), "
        "growth_highlights (list of strings — notable wins, metrics, or achievements), "
        "key_decisions (list of strings — important decisions made or significant actions taken), "
        "pending_actions (list of strings — outstanding items or follow-ups across all agents)"
    )

    raw = await _llm.complete(
        provider="openai", model="gpt-4o-mini",
        system="You are a chief of staff writing a concise but complete executive daily briefing.",
        messages=[{"role": "user", "content": prompt}],
    )
    tokens = _llm.count_tokens(raw)

    try:
        data = safe_json_loads(raw)
        return (
            data.get("overall_summary", ""),
            data.get("growth_highlights", []),
            data.get("key_decisions", []),
            data.get("pending_actions", []),
            tokens,
        )
    except Exception:
        return raw[:400], [], [], [], tokens


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/briefing", response_model=DailyBriefing, summary="Generate daily activity briefing")
async def daily_briefing(request: BriefingRequest) -> DailyBriefing:
    """
    Accepts full message histories for all 6 agents and returns a structured
    daily briefing — per-agent summaries with metrics, plus a cross-agent synthesis.
    """
    date = request.date or datetime.utcnow().strftime("%Y-%m-%d")

    if settings.MOCK_MODE:
        return DailyBriefing(
            date=date,
            user_id=request.user_id,
            overall_summary=(
                "Today was a high-output day across legal, content, and executive operations. "
                "Lex completed a full NDA risk analysis flagging one critical residuals clause. "
                "Maya produced three pieces of content including a Series A LinkedIn announcement. "
                "Vega cleared 12 unread emails, drafted two investor replies, and blocked 2 hours of focus time."
            ),
            agents_active=["maya", "lex", "vega"],
            agents_breakdown={
                "maya": AgentBriefing(
                    active=True,
                    message_count=6,
                    summary="Created three content pieces: a LinkedIn post announcing the Series A, an Instagram caption for a product demo video, and a thread draft for Twitter. All content was tailored to the founder's voice.",
                    actions_taken=[
                        "Drafted LinkedIn post for Series A announcement",
                        "Wrote Instagram caption for product demo",
                        "Created Twitter thread outline",
                    ],
                    key_outputs=[
                        "LinkedIn post (~280 words, professional tone)",
                        "Instagram caption with 5 hashtags",
                        "5-tweet thread draft",
                    ],
                    metrics={"posts_created": 3, "platforms_covered": 3, "estimated_reach": "12K–18K"},
                    follow_ups=["Schedule LinkedIn post for Tuesday 9am", "Get founder approval on Twitter thread"],
                ),
                "rex": AgentBriefing(
                    active=False,
                    message_count=0,
                    summary="No activity today.",
                    actions_taken=[], key_outputs=[], metrics={}, follow_ups=[],
                ),
                "scout": AgentBriefing(
                    active=False,
                    message_count=0,
                    summary="No activity today.",
                    actions_taken=[], key_outputs=[], metrics={}, follow_ups=[],
                ),
                "sage": AgentBriefing(
                    active=False,
                    message_count=0,
                    summary="No activity today.",
                    actions_taken=[], key_outputs=[], metrics={}, follow_ups=[],
                ),
                "lex": AgentBriefing(
                    active=True,
                    message_count=4,
                    summary="Performed a full structured analysis of an investor NDA. Identified one high-severity residuals clause and three missing protections. Recommended negotiation rather than signing.",
                    actions_taken=[
                        "Analyzed investor NDA (doc_abc123)",
                        "Identified risks and unusual clauses",
                        "Generated negotiation guidance",
                    ],
                    key_outputs=[
                        "Risk level: medium (score 6/10)",
                        "1 high-severity clause: Residuals (Section 7)",
                        "4 negotiation points with specific suggested language",
                        "Recommended action: negotiate",
                    ],
                    metrics={"contracts_analyzed": 1, "risks_identified": 4, "negotiation_points": 4},
                    follow_ups=["Share analysis with legal counsel before Thursday investor call"],
                ),
                "vega": AgentBriefing(
                    active=True,
                    message_count=8,
                    summary="Processed 12 unread emails, drafted replies to two investor inquiries, and scheduled a due diligence call with Accel for Thursday 3pm. Blocked 2-hour focus time for deep work.",
                    actions_taken=[
                        "Triaged 12 unread emails",
                        "Drafted reply to Sarah Chen (Accel Partners)",
                        "Drafted reply to Marcus Rivera (GrowthCo)",
                        "Created calendar event: Due Diligence Call — Accel, Thu 3pm",
                    ],
                    key_outputs=[
                        "2 investor email drafts saved to Gmail",
                        "1 calendar event created with Google Meet link",
                        "Inbox cleared to 0 urgent items",
                    ],
                    metrics={"emails_processed": 12, "drafts_created": 2, "events_created": 1, "urgent_emails": 2},
                    follow_ups=[
                        "Send metrics deck to Sarah Chen before Thursday",
                        "Follow up with Marcus Rivera if no response by Friday",
                    ],
                ),
            },
            growth_highlights=[
                "Series A announcement content ready to publish across 3 platforms",
                "Investor NDA risk assessed — critical clause identified before signing",
                "Due diligence call locked in with Accel Partners for Thursday",
                "Inbox cleared: 2 high-priority investor replies drafted",
            ],
            key_decisions=[
                "NDA: Do not sign as-is — negotiate residuals clause first",
                "Content: Publish LinkedIn post Tuesday 9am for maximum engagement",
                "Meeting: Confirmed Accel due diligence call Thursday 3pm EST",
            ],
            pending_actions=[
                "Get founder sign-off on Twitter thread before publishing",
                "Send metrics deck to Sarah Chen (Accel) by Wednesday EOD",
                "Follow up with Marcus Rivera (GrowthCo) by Friday if no reply",
                "Share NDA analysis with legal counsel before investor call",
            ],
        )

    # ── Real mode: parallel per-agent extraction then synthesis ──────────────

    all_agents = list(_AGENT_META.keys())

    # Fill in empty histories for any agents not sent
    conversations = {
        slug: request.conversations.get(slug, [])
        for slug in all_agents
    }

    # Run all per-agent extractions in parallel
    results = await asyncio.gather(*[
        _extract_agent_briefing(slug, conversations[slug])
        for slug in all_agents
    ])

    agents_breakdown: dict[str, AgentBriefing] = {}
    total_tokens = 0
    for slug, briefing, tokens in results:
        agents_breakdown[slug] = briefing
        total_tokens += tokens

    agents_active = [slug for slug, b in agents_breakdown.items() if b.active]

    # Synthesize overall briefing from all agent summaries
    overall_summary, growth_highlights, key_decisions, pending_actions, synth_tokens = (
        await _synthesize_briefing(agents_breakdown, date)
    )
    total_tokens += synth_tokens

    return DailyBriefing(
        date=date,
        user_id=request.user_id,
        overall_summary=overall_summary,
        agents_active=agents_active,
        agents_breakdown=agents_breakdown,
        growth_highlights=growth_highlights,
        key_decisions=key_decisions,
        pending_actions=pending_actions,
        tokens_used=total_tokens,
        model_used="gpt-4o-mini",
    )
