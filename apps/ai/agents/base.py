import asyncio
import json
import logging
import time
import uuid
from abc import ABC
from datetime import datetime, timezone
from typing import AsyncGenerator

from core.llm import LLMClient
from core.observability import set_llm_context
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolCall, ToolResult
from core.mcp.cache import get_mcp_tools
from core.mcp.client import call_connection_tool, McpToolCallError

# ── Terminal logger ─────────────────────────────────────────────────────────
# Prints structured, colorized logs to stdout for every agent turn so you can
# see exactly what the LLM decided, which tools fired, and what context landed.

_R  = "\033[91m"   # red     – errors / rejections
_Y  = "\033[93m"   # yellow  – warnings / fallbacks
_G  = "\033[92m"   # green   – success / results
_B  = "\033[94m"   # blue    – LLM decisions
_M  = "\033[95m"   # magenta – tool calls
_C  = "\033[96m"   # cyan    – turn header / metadata
_W  = "\033[97m"   # white   – labels
_DIM = "\033[2m"   # dim     – secondary info
_X  = "\033[0m"    # reset

_log = logging.getLogger("agent.trace")


def _trim(s: str, n: int = 120) -> str:
    s = str(s)
    return s if len(s) <= n else s[:n] + "…"


def _args_summary(args: dict) -> str:
    parts = []
    for k, v in args.items():
        parts.append(f"{k}={_trim(str(v), 40)!r}")
    return ", ".join(parts) if parts else ""


def _humanize_mcp_call(real_tool_name: str, arguments: dict) -> str:
    """Turn a Composio tool slug (e.g. GMAIL_SEND_EMAIL) + its call arguments
    into a short human-readable summary for the confirm-action UI."""
    label = real_tool_name.replace("_", " ").strip().title()
    preview = _args_summary(arguments)
    return f"{label} — {preview}" if preview else label


def _trace_action_label(real_tool_name: str, integration_slug: str | None) -> str:
    """The action half of a trace line, with the toolkit prefix stripped so the
    UI can render "Gmail · Fetch Emails" instead of "Gmail · Gmail Fetch Emails".
    Composio slugs are conventionally TOOLKIT_VERB_NOUN, but not universally —
    only strip when the prefix actually matches the integration."""
    words = real_tool_name.replace("-", "_").split("_")
    if integration_slug and words:
        # Our slugs and Composio's tool prefixes don't segment the same way, and
        # a prefix can span several words: "google-calendar" prefixes tools as
        # GOOGLECALENDAR_ (joined into one word), "microsoft-teams" as
        # MICROSOFT_TEAMS_ (two words), and "outlook-mail" as plain OUTLOOK_
        # (first segment only). Consume greedily for the first two shapes, then
        # fall back to the first segment for the third.
        normalized = integration_slug.replace("-", "").replace("_", "").lower()
        accumulated = ""
        matched = 0
        for index, word in enumerate(words, start=1):
            accumulated += word.lower()
            if accumulated == normalized:
                matched = index
                break
            if not normalized.startswith(accumulated):
                break
        if not matched and words[0].lower() == integration_slug.replace("-", "_").split("_")[0].lower():
            matched = 1
        if matched:
            words = words[matched:] or [real_tool_name]
    return " ".join(w.capitalize() for w in words if w) or real_tool_name


# Keys whose value, when a list, is the "how many things came back" count for a
# trace line. Ordered — Composio nests the real payload under `data`, so that is
# unwrapped first (see _trace_detail) rather than matched here.
_COUNTABLE_KEYS = ("messages", "items", "results", "events", "records", "files", "rows", "data")


def _trace_detail(result) -> str | None:
    """A short "what came back" fragment for a trace line, e.g. "14 results".
    Returns None when nothing countable is present — the UI then shows only the
    tool name, which is still more than the user sees today."""
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except Exception:
            return None
    if isinstance(result, list):
        return f"{len(result)} result{'' if len(result) == 1 else 's'}"
    if not isinstance(result, dict):
        return None
    # Composio wraps real payloads as {"data": {...}, "successful": bool}.
    inner = result.get("data")
    if isinstance(inner, (dict, list)):
        nested = _trace_detail(inner)
        if nested:
            return nested
    for key in _COUNTABLE_KEYS:
        value = result.get(key)
        if isinstance(value, list):
            return f"{len(value)} result{'' if len(value) == 1 else 's'}"
    return None


def _build_tool_trace(
    all_tool_calls: list[dict],
    alias_map: dict[str, tuple[str, str]],
    integration_by_connection: dict[str, str],
    write_aliases: set[str],
) -> list[dict]:
    """Compact, user-facing record of what this turn actually did.

    Deliberately NOT metadata["tool_calls"] — that carries full tool results
    (up to MAX_TOOL_RESULT_CHARS each) and is sized for action-card detection,
    not for shipping to a browser. This keeps only what a trace line renders.
    """
    trace: list[dict] = []
    for call in all_tool_calls:
        alias = call.get("name") or ""
        mcp_target = alias_map.get(alias)
        if mcp_target:
            connection_id, real_tool_name = mcp_target
            integration = integration_by_connection.get(connection_id)
            label = _trace_action_label(real_tool_name, integration)
        else:
            integration = None
            label = _trace_action_label(alias, None)

        if call.get("is_error"):
            status = "error"
        elif alias in write_aliases:
            # Writes are staged for confirmation rather than executed, so the
            # trace must not claim they happened — see mcp_pending_actions.
            status = "pending"
        else:
            status = "ok"

        entry = {
            "label": label,
            "integration": integration,
            "status": status,
        }
        if status == "ok":
            detail = _trace_detail(call.get("result"))
            if detail:
                entry["detail"] = detail
        if call.get("duration_ms") is not None:
            entry["durationMs"] = call["duration_ms"]
        trace.append(entry)
    return trace

# Was 10000, then 50000 — both too small for real MCP tool results at
# realistic data volumes (verified live: an 89-row Razorpay payments list is
# 65,068 chars in full, truncating mid-JSON and leaving Rex unable to compute
# an accurate total — it correctly refused to guess rather than hallucinate,
# but the limit itself was the actual problem). This will need revisiting as
# data volumes grow further (200+ rows on a similar endpoint would exceed
# this too) — a pagination/field-projection approach would scale better than
# repeatedly raising a hardcoded cap, but wasn't the chosen fix today.
MAX_TOOL_RESULT_CHARS = 100000
_TOOL_TIMEOUT = 300.0       # seconds — safety net for tools with no internal timeout
_MEMORY_HARD_CAP = 8000     # chars (~2k tokens) — prevents context overflow on any message

# Maps AI tool names to frontend AgentActionId values for rich card rendering
RICH_TOOL_TO_ACTION_ID: dict[str, str] = {
    "draft_content":            "maya:draft-content",
    "generate_ideas":           "maya:generate-ideas",
    "generate_variants":        "maya:generate-variants",
    "revise_content":           "maya:revise",
    "keyword_research":         "sage:keyword-research",
    "generate_blog":            "sage:generate-blog",
    "analyze_content":          "sage:analyze-content",
    "content_brief":            "sage:content-brief",
    "serp_analysis":            "sage:serp-analysis",
    "topical_map":              "sage:topical-map",
    "meta_optimizer":           "sage:meta-optimizer",
    "page_seo_audit":           "sage:page-seo-audit",
    "site_audit":               "sage:site-audit",
    "research_topic":           "scout:research-topic",
    "research_company":         "scout:research-company",
    "trending_topics":          "scout:trending-topics",
    "discover_competitors":     "scout:discover-competitors",
    "analyze_metrics":          "rex:analyze-metrics",
    "forecast_metric":          "rex:forecast",
    "financial_analysis":       "rex:financial-analysis",
    "compile_briefing":         "rex:compile-briefing",
    "calculate_runway":         "rex:runway",
    "unit_economics":           "rex:unit-economics",
    "scenario_model":           "rex:scenario",
    "weekly_digest":            "rex:weekly-digest",
    "generate_investor_update": "rex:investor-update",
    "analyze_contract":         "lex:analyze-contract",
    "explain_legal":            "lex:explain",
    "draft_document":           "lex:draft-document",
    "legal_research":           "lex:legal-research",
    "compliance_check":         "lex:compliance-check",
    # Vega has no native tools — all MCP-routed, see agents/vega/agent.py.
}


# Primary deliverables rank above ideation/helper tools so that when the LLM
# calls both in one turn (e.g. draft_content + generate_ideas), the card that
# surfaces is the one the user actually asked for, not the side-call.
_RICH_TOOL_PICK_ORDER: list[str] = [
    # ── Content deliverables (highest priority) ──────────────────────────
    "draft_content",
    "generate_variants",
    "revise_content",
    "draft_carousel",
    "regenerate_content",
    "generate_blog",
    # ── Research / analysis deliverables ─────────────────────────────────
    "analyze_contract",
    "draft_document",
    "legal_research",
    "compliance_check",
    "explain_legal",
    "keyword_research",
    "serp_analysis",
    "topical_map",
    "meta_optimizer",
    "page_seo_audit",
    "site_audit",
    "content_brief",
    "analyze_content",
    "research_topic",
    "research_company",
    "discover_competitors",
    # ── Analytics deliverables ────────────────────────────────────────────
    "analyze_metrics",
    "forecast_metric",
    "financial_analysis",
    "compile_briefing",
    "calculate_runway",
    "unit_economics",
    "scenario_model",
    "weekly_digest",
    "generate_investor_update",
    # ── Ideation helpers (lowest priority — often called alongside drafts) ─
    "generate_ideas",
    "trending_topics",
]


def _pick_rich_result(tool_calls: list[dict]) -> tuple[str | None, dict | None]:
    """Return (action_id, result_dict) preferring primary deliverables over ideation helpers.

    When the LLM fires draft_content + generate_ideas in the same turn, this
    ensures the draft card surfaces rather than the ideas list.
    """
    executed = [
        tc for tc in tool_calls
        if isinstance(tc.get("result"), dict) and not tc.get("is_error")
    ]
    if not executed:
        return None, None

    executed_names = {tc["name"] for tc in executed}

    for name in _RICH_TOOL_PICK_ORDER:
        if name not in executed_names:
            continue
        mapped = RICH_TOOL_TO_ACTION_ID.get(name)
        if not mapped:
            continue
        # Return the first (earliest) call with this name
        for tc in executed:
            if tc["name"] == name:
                return mapped, tc["result"]

    # Fallback: last executed call that has a mapping (original behaviour)
    for tc in reversed(executed):
        mapped = RICH_TOOL_TO_ACTION_ID.get(tc.get("name", ""))
        if mapped:
            return mapped, tc["result"]

    return None, None


class BaseAgent(ABC):
    slug: str = "base"
    name: str = "Base Agent"
    default_provider: str = "openai"
    default_model: str = "gpt-5.6-luna"
    personality: str = "Helpful AI assistant"

    MAX_TOOL_CALLS = 5  # Circuit breaker for tool-calling loop

    # Native tool names this agent will drop from its tool list when the org
    # has set an mcp_tool_preference for it (see chat_sync). Opt-in per agent —
    # empty by default. Exists because prompt-level "prefer the MCP tool"
    # guidance is unreliable for native tools that source data internally
    # rather than choosing between tools they're offered (verified: Scout's
    # research_topic/discover_competitors call Serper directly regardless of
    # a connected Tavily tool being present in the same tool list).
    SUPERSEDABLE_BY_MCP: set[str] = set()

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        self.llm = llm_client
        self.rag = rag_service

    # ── Shared prompt blocks ────────────────────────────────────────────────
    # Call these from every agent's build_system_prompt instead of duplicating
    # the text. Any improvement here automatically reaches all 6 agents.

    def _core_response_style_block(self) -> str:
        """Universal response style rules — injected by every agent."""
        return (
            "\n\nHOW TO RESPOND:\n"
            "Lead with the answer — no preamble, no 'Great question!', no 'Certainly!', no 'I'd be happy to'.\n"
            "Write like a smart teammate messaging on Slack: direct, human, zero corporate fluff.\n"
            "Keep it tight — if 2 sentences work, don't write 5. Match the user's energy and detail level.\n"
            "For numbers and data: headline figure first, context second.\n"
            "Never say 'As an AI', 'I should note', or use filler transitions like 'It's worth mentioning'.\n"
        )

    def _mid_conversation_ack_block(self) -> str:
        """Universal mid-conversation ack instruction — use this whenever has_history=True."""
        return (
            "This conversation is already underway. "
            "When the user sends a short reaction — 'thanks', 'ok', 'great', 'perfect', "
            "'got it', 'nice', 'love it', 'sure', 'cool', 'wow', 'amazing', 'sounds good' — "
            "reply in ONE short sentence that sounds like a real person texting, not a support bot. "
            "Never say 'If you need anything else', 'feel free to ask', 'I'd be happy to', "
            "or 'Is there anything else I can help you with?' — those are chatbot clichés. "
            "Good examples: 'Anytime!', 'Of course!', 'Happy to help.', 'Let's go 🔥', 'On it!'. "
            "Never fall back to an intro greeting mid-conversation.\n"
        )

    def _no_hallucination_block(self) -> str:
        """Universal no-hallucination + domain-redirect rule — injected by every agent."""
        return (
            "\n## CRITICAL — No Hallucination, No Domain Overreach\n"
            "NEVER fabricate facts, numbers, legal advice, or claims outside your expertise.\n"
            "If a question is clearly outside your domain, redirect the user to the right team member "
            "instead of guessing. Say which agent handles it and why.\n"
            "It's better to redirect cleanly than to give a mediocre or made-up answer.\n"
        )

    def _current_date_block(self) -> str:
        """Universal grounding for 'today' — injected by every agent. Without
        this the LLM has no way to know the real current date and silently
        guesses (observed: a Gmail date-range search built for 2024 instead
        of the real year, returning zero results)."""
        now = datetime.now(timezone.utc)
        return f"\n\nToday's date is {now.strftime('%A, %Y-%m-%d')} (UTC, current time {now.strftime('%H:%M')}). Use this for any relative date/time reasoning — 'this year', 'last quarter', 'today', search date ranges, etc.\n"

    def _mcp_catalog_block(self, catalog: list[dict] | None) -> str:
        """Universal 'what can you connect to' awareness block. `catalog` is
        Node's per-agent slice of the integrations catalog (request.metadata
        ['mcp_catalog']), each entry tagged connected: true/false — see
        contextService.ts's callAgentWithContext. Injected by chat_sync so
        every agent can answer capability questions accurately instead of
        falling back to a native tool's hardcoded platform list."""
        if not catalog:
            return ""
        connected = [c["name"] for c in catalog if c.get("connected")]
        not_connected = [c["name"] for c in catalog if not c.get("connected")]
        lines = [
            "\n## Your Possible Integrations\n",
            "If the user asks what platforms, tools, or services you can connect to or use, "
            "answer using this exact list — don't guess or rely on any other list elsewhere "
            "in this prompt, which may be incomplete or out of date.\n",
        ]
        if connected:
            lines.append(f"Connected now, ready to use: {', '.join(connected)}.\n")
        if not_connected:
            lines.append(
                "Not yet connected — tell the user to connect these via Settings > Integrations "
                f"(or the connect panel in this chat) if they want to use them: {', '.join(not_connected)}.\n"
            )
        return "".join(lines)

    def _mcp_supersede_block(self, superseded_names: list[str], replacement_mcp_names: list[str]) -> str:
        """Tells the LLM what to use INSTEAD when SUPERSEDABLE_BY_MCP removed
        some of its usual native tools this turn (see chat_sync) — without
        this, the rest of the prompt (e.g. get_tool_instructions()) still
        references the now-absent native tools by name and the LLM has no
        replacement guidance, so it tends to just answer from memory with no
        tool call at all instead of reaching for the raw MCP tool."""
        if not superseded_names:
            return ""
        removed = ", ".join(f"`{n}`" for n in superseded_names)
        if replacement_mcp_names:
            replacements = ", ".join(f"`{n}`" for n in replacement_mcp_names)
            return (
                "\n## CRITICAL — your default tools have been replaced this turn\n"
                f"The org has configured a preferred external source, so {removed} are NOT in your "
                f"tool list right now — do not try to call them. For ANY request that would normally "
                f"need one of those (a topic question, market/company insight, trend lookup, "
                f"competitor question, etc.), use one of these instead: {replacements}. Treat any "
                "question with a research/lookup angle as something to actually call one of these tools "
                "for — do not just answer from your own memory because the usual named tool is missing.\n"
            )
        return (
            "\n## CRITICAL — your default tools are unavailable this turn\n"
            f"The org has configured a preferred external source for this, but it isn't connected right "
            f"now, so {removed} are NOT in your tool list. Tell the user their preferred research source "
            "isn't connected and to reconnect it, rather than answering from memory or claiming to have "
            "looked something up.\n"
        )

    # ── Tool-use instructions (override in subclass for stricter behaviour) ─

    def get_tool_instructions(self) -> str:
        return (
            "\n\nYou have access to specialized tools. "
            "Call a tool ONLY when the user has made an explicit request that a tool fulfills. "
            "For greetings, acknowledgments ('thanks', 'great', 'ok', 'love it'), reactions, "
            "or open-ended conversation, reply directly with no tool call.\n"
            "ONE tool per intent: if the user's intent is singular (create, analyze, research), "
            "call exactly one tool that fulfills it. Never call a secondary or exploratory tool "
            "alongside the primary one — it produces duplicate output and shows the wrong card. "
            "When using tools, synthesize the results into a helpful, natural response."
        )

    # ── Tool definitions (override in subclass) ─────────────────────────

    def validate_tool_call(
        self, name: str, arguments: dict, tools: list[ToolDefinition] | None = None
    ) -> str | None:
        """Returns a rejection reason string if the call is structurally invalid, else None.

        `tools` defaults to self.get_tools() for backwards compatibility, but
        chat_sync() passes its full merged list (native + ask_agent + MCP) —
        without that, MCP tools' required fields (declared via raw_schema,
        not ToolParameter) were never validated at all.
        """
        for tool in (tools if tools is not None else self.get_tools()):
            if tool.name != name:
                continue
            if tool.raw_schema is not None:
                for required_name in tool.raw_schema.get("required", []) or []:
                    val = arguments.get(required_name)
                    if val is None or (isinstance(val, str) and not val.strip()):
                        return f"Missing required parameter: {required_name}"
                return None
            for param in tool.parameters:
                if not param.required:
                    continue
                val = arguments.get(param.name)
                if val is None or (isinstance(val, str) and not val.strip()):
                    return f"Missing required parameter: {param.name}"
            return None
        return None

    def get_tools(self) -> list[ToolDefinition]:
        """Return agent-specific tool definitions. Override in subclass."""
        return []

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        """Execute a tool by name. Override in subclass. Returns result string."""
        raise NotImplementedError(f"Tool '{name}' not implemented on {self.slug}")

    # ── System prompt ───────────────────────────────────────────────────

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
        has_history: bool = False,
    ) -> str:
        # Subclasses override this to inject brand_kit context. The base prompt
        # is intentionally minimal so the registry/cross-agent fallbacks don't
        # eagerly hit the brand-kit fetch.
        prompt = f"You are {self.name}, {self.personality}.\n\n"
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        prompt += self._current_date_block()
        prompt += self._core_response_style_block()
        if has_history:
            prompt += self._mid_conversation_ack_block()
        prompt += self._no_hallucination_block()
        return prompt

    # ── Streaming (unchanged, no tool calling) ──────────────────────────

    async def chat_stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Full pipeline: brand_kit -> RAG -> prompt -> stream LLM."""
        set_llm_context(
            org_id=request.organization_id,
            agent_slug=self.slug,
            conversation_id=request.conversation_id,
        )
        system_prompt = await self.build_system_prompt(
            request.user_id, request.organization_id,
            has_history=bool(request.history),
        )

        # RAG retrieval — skip for short conversational messages (no semantic benefit)
        rag_chunks: list = []
        if len(request.message.split()) > 4:
            try:
                rag_chunks = await self.rag.retrieve(
                    user_id=request.user_id,
                    query=request.message,
                    top_k=5,
                    source_agent=self.slug,
                )
            except Exception:
                rag_chunks = []
        if rag_chunks:
            rag_context = "\n\n".join(c.get("content", "") for c in rag_chunks)
            system_prompt += f"\n\nRelevant context from knowledge base:\n{rag_context}"

        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            word_count = len(request.message.split())
            if word_count <= 5 and len(memory_context) > 1200:
                memory_context = memory_context[:1200].rstrip()
            elif len(memory_context) > _MEMORY_HARD_CAP:
                memory_context = memory_context[:_MEMORY_HARD_CAP].rstrip()
            system_prompt += f"\n\n{memory_context}"

        messages = [
            {"role": m.role, "content": m.content} for m in request.history
        ] + [{"role": "user", "content": request.message}]

        async for token in self.llm.stream(
            provider=self.default_provider,
            model=self.default_model,
            system=system_prompt,
            messages=messages,
        ):
            yield token

    # ── Simple sync chat (no tools) ─────────────────────────────────────

    async def _chat_sync_no_tools(self, request: ChatRequest) -> ChatSyncResponse:
        """Collect all streamed tokens into a single sync response. No tool calling."""
        tokens = []
        async for token in self.chat_stream(request):
            tokens.append(token)
        full_text = "".join(tokens)
        tokens_used = self.llm.count_tokens(full_text)
        return ChatSyncResponse(
            response=full_text,
            agent=self.slug,
            message_id=str(uuid.uuid4()),
            tokens_used=tokens_used,
            model_used=self.default_model,
            metadata={},
        )

    # ── Smart sync chat (with tool calling) ─────────────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        """Tool-calling chat loop. LLM decides when to call tools autonomously."""
        _turn_start = time.monotonic()
        set_llm_context(
            org_id=request.organization_id,
            agent_slug=self.slug,
            conversation_id=request.conversation_id,
        )

        has_memory = bool(request.metadata.get("memory_context"))
        print(
            f"\n{_C}{'─'*70}{_X}\n"
            f"{_C}[{self.slug.upper()}]{_X} {_W}msg:{_X} {_trim(request.message, 80)!r}  "
            f"{_DIM}| history={len(request.history)} | memory={'✓' if has_memory else '✗'} "
            f"| org={request.organization_id[:8] or '(none)'}{_X}"
        )

        from agents.registry import get_ask_agent_tool

        tools = self.get_tools()
        if not request.metadata.get("_cross_agent_call", False):
            ask_agent_tool = get_ask_agent_tool()
            # Remove own agent from ask_agent enum to prevent self-calls
            for p in ask_agent_tool.parameters:
                if p.name == "agent_slug" and p.enum:
                    p.enum = [s for s in p.enum if s != self.slug]
            tools.append(ask_agent_tool)

        # Merge in this org's connected MCP tools for this agent (resolved
        # and org-scoped by Node's contextService.ts — see mcp_connections).
        # mcp_alias_map is a LOCAL var, not self.state: agents are singletons
        # shared across every org's concurrent requests (see registry.py), so
        # per-call state must never live on self.
        mcp_connections = request.metadata.get("mcp_connections") or []
        mcp_alias_map: dict[str, tuple[str, str]] = {}
        # connectionId -> integrationSlug, so the visible tool trace can name
        # the system each call went to ("Gmail") rather than a bare tool slug.
        integration_by_connection: dict[str, str] = {
            c["connectionId"]: c.get("integrationSlug") or c.get("toolkitSlug") or "mcp"
            for c in mcp_connections
            if c.get("connectionId")
        }
        # Write-capable MCP tools (see Node's classifyWrite) get staged for
        # user confirmation instead of executed immediately — see _run_one
        # below and mcp_pending_actions.
        mcp_write_set: set[str] = set()
        mcp_pending_actions: list[dict] = []
        # Deterministic override (see SUPERSEDABLE_BY_MCP): when set, only the
        # preferred integration's tools get merged in, and this agent's own
        # supersedable native tools are dropped below — forcing the LLM to use
        # the preferred MCP tool directly instead of a native default it can't
        # reliably be prompted away from.
        tool_preference = request.metadata.get("mcp_tool_preference")
        if tool_preference and mcp_connections:
            mcp_connections = [c for c in mcp_connections if c.get("integrationSlug") == tool_preference]
        if mcp_connections:
            mcp_tools, mcp_alias_map = await get_mcp_tools(
                request.organization_id, self.slug, mcp_connections,
                reserved_tools=len(tools),
            )
            tools.extend(mcp_tools)
            mcp_write_set = {td.name for td in mcp_tools if td.is_write}
        superseded_names: list[str] = []
        replacement_mcp_names: list[str] = []
        if tool_preference and self.SUPERSEDABLE_BY_MCP:
            superseded_names = [t.name for t in tools if t.name in self.SUPERSEDABLE_BY_MCP]
            if superseded_names:
                tools = [t for t in tools if t.name not in self.SUPERSEDABLE_BY_MCP]
                replacement_mcp_names = [n for n in mcp_alias_map if n.startswith(f"mcp_{tool_preference}_")]

        # If no tools defined (shouldn't happen, but safety), fall back
        if len(tools) <= 1:  # only ask_agent
            return await self._chat_sync_no_tools(request)

        # Build system prompt and fetch RAG context concurrently for lower latency.
        # Stable static prefix (brand kit + rules) comes first so OpenAI prefix
        # caching can kick in per-org; dynamic RAG/memory appended after.
        is_cross_agent = request.metadata.get("_cross_agent_call", False)

        async def _build_prompt() -> str:
            return await self.build_system_prompt(
                request.user_id, request.organization_id,
                use_brand_kit=not is_cross_agent,
                has_history=bool(request.history),
            )

        async def _fetch_rag() -> list:
            # Skip RAG for short conversational messages — "thanks", "ok", "great",
            # "hi", etc. don't benefit from semantic retrieval and it just adds latency.
            if len(request.message.split()) <= 4:
                return []
            try:
                return await self.rag.retrieve(
                    user_id=request.user_id,
                    query=request.message,
                    top_k=5,
                    source_agent=self.slug,
                )
            except Exception:
                return []

        system_prompt, rag_chunks = await asyncio.gather(_build_prompt(), _fetch_rag())
        if rag_chunks:
            rag_context = "\n\n".join(c.get("content", "") for c in rag_chunks)
            system_prompt += f"\n\nRelevant context from knowledge base:\n{rag_context}"
            print(f"  {_DIM}[ctx] rag_chunks={len(rag_chunks)}{_X}")
        else:
            words = len(request.message.split())
            if words <= 4:
                print(f"  {_DIM}[ctx] rag skipped (msg ≤ 4 words){_X}")
            else:
                print(f"  {_DIM}[ctx] rag=0 chunks{_X}")

        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            original_len = len(memory_context)
            word_count = len(request.message.split())
            # Short messages only need the summary section (~1200 chars)
            if word_count <= 5 and original_len > 1200:
                memory_context = memory_context[:1200].rstrip()
                print(f"  {_DIM}[ctx] memory_block trimmed {original_len}→1200 chars (short msg){_X}")
            # Hard cap for all messages — prevents context overflow regardless of length
            elif original_len > _MEMORY_HARD_CAP:
                memory_context = memory_context[:_MEMORY_HARD_CAP].rstrip()
                print(f"  {_DIM}[ctx] memory_block hard-capped {original_len}→{_MEMORY_HARD_CAP} chars{_X}")
            else:
                print(f"  {_DIM}[ctx] memory_block injected ({original_len} chars){_X}")
            system_prompt += f"\n\n{memory_context}"
        else:
            print(f"  {_DIM}[ctx] no memory_block{_X}")

        # Add tool-use instructions to system prompt
        system_prompt += self.get_tool_instructions()
        system_prompt += self._mcp_catalog_block(request.metadata.get("mcp_catalog"))
        system_prompt += self._mcp_supersede_block(superseded_names, replacement_mcp_names)

        messages = [
            {"role": m.role, "content": m.content} for m in request.history
        ] + [{"role": "user", "content": request.message}]

        all_tool_calls: list[dict] = []

        for _iteration in range(self.MAX_TOOL_CALLS):
            print(f"  {_B}[llm]  iter={_iteration} tool_choice=auto{_X}")
            response = await self.llm.complete_with_tools(
                provider=self.default_provider,
                model=self.default_model,
                system=system_prompt,
                messages=messages,
                tools=tools,
            )
            print(f"  {_B}[llm]  finish_reason={response.finish_reason} "
                  f"tool_calls_proposed={len(response.tool_calls)}{_X}")

            if response.finish_reason == "stop":
                # LLM gave a final text answer
                full_text = response.content or ""
                tokens_used = self.llm.count_tokens(full_text)
                metadata: dict = {}
                if all_tool_calls:
                    metadata["tool_calls"] = all_tool_calls
                if mcp_pending_actions:
                    metadata["pending_actions"] = mcp_pending_actions
                # Surface the last rich tool result as a card payload
                action_id_out, action_result = _pick_rich_result(all_tool_calls)
                elapsed = time.monotonic() - _turn_start
                print(
                    f"  {_G}[done] conversational reply{_X}  "
                    f"{_DIM}action={action_id_out or 'none'} | "
                    f"tokens≈{tokens_used} | {elapsed:.2f}s{_X}\n"
                    f"  {_DIM}reply: {_trim(full_text, 100)!r}{_X}"
                )
                return ChatSyncResponse(
                    response=full_text,
                    agent=self.slug,
                    message_id=str(uuid.uuid4()),
                    tokens_used=tokens_used,
                    model_used=self.default_model,
                    metadata=metadata,
                    action_id=action_id_out,
                    action_result=action_result,
                    tool_trace=_build_tool_trace(
                        all_tool_calls, mcp_alias_map, integration_by_connection, mcp_write_set
                    ),
                )

            # Validate calls before executing — reject structurally invalid ones.
            stub_start = len(all_tool_calls)
            rejected: list[int] = []
            for idx, tc in enumerate(response.tool_calls):
                reason = self.validate_tool_call(tc.name, tc.arguments, tools)
                if reason:
                    rejected.append(idx)
                    print(f"  {_R}[reject] {tc.name}({_args_summary(tc.arguments)}) → {reason}{_X}")

            # All calls invalid on the first iteration (nothing executed yet) →
            # re-run with tool_choice="none" to get a clean conversational reply.
            if rejected and len(rejected) == len(response.tool_calls) and not all_tool_calls:
                print(f"  {_Y}[fallback] all {len(rejected)} call(s) rejected → re-run tool_choice=none{_X}")
                fallback = await self.llm.complete_with_tools(
                    provider=self.default_provider,
                    model=self.default_model,
                    system=system_prompt,
                    messages=messages,
                    tools=tools,
                    tool_choice="none",
                )
                full_text = fallback.content or ""
                elapsed = time.monotonic() - _turn_start
                print(
                    f"  {_G}[done] fallback conversational reply{_X}  "
                    f"{_DIM}tokens≈{self.llm.count_tokens(full_text)} | {elapsed:.2f}s{_X}\n"
                    f"  {_DIM}reply: {_trim(full_text, 100)!r}{_X}"
                )
                return ChatSyncResponse(
                    response=full_text,
                    agent=self.slug,
                    message_id=str(uuid.uuid4()),
                    tokens_used=self.llm.count_tokens(full_text),
                    model_used=self.default_model,
                    metadata={},
                )

            valid_tool_calls = [tc for i, tc in enumerate(response.tool_calls) if i not in rejected]

            for tc in valid_tool_calls:
                print(f"  {_M}[tool]  → {tc.name}({_args_summary(tc.arguments)}){_X}")

            # Append stub entries first so indices are stable, then backfill after gather.
            for tc in valid_tool_calls:
                all_tool_calls.append({
                    "id": tc.id,
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "result": None,
                    "is_error": False,
                })

            async def _run_one(tc) -> str:
                if tc.name == "ask_agent":
                    coro = self._execute_cross_agent_call(
                        tc.arguments, request.user_id, request.organization_id, mcp_connections
                    )
                elif tc.name in mcp_alias_map:
                    if tc.name in mcp_write_set:
                        connection_id, real_tool_name = mcp_alias_map[tc.name]
                        pending_id = str(uuid.uuid4())
                        mcp_pending_actions.append({
                            "id": pending_id,
                            "connection_id": connection_id,
                            "tool_name": real_tool_name,
                            "arguments": tc.arguments,
                            "summary": _humanize_mcp_call(real_tool_name, tc.arguments),
                        })
                        return json.dumps({
                            "status": "pending_confirmation",
                            "message": (
                                "Staged for the user to confirm or reject in the UI. "
                                "Do not call this tool again this turn — tell the user "
                                "it's ready for their approval."
                            ),
                        })
                    coro = self._execute_mcp_tool(
                        tc.name, tc.arguments, request.organization_id, mcp_alias_map
                    )
                else:
                    coro = self.execute_tool(
                        tc.name, tc.arguments, request.user_id, request.organization_id
                    )
                try:
                    return await asyncio.wait_for(coro, timeout=_TOOL_TIMEOUT)
                except asyncio.TimeoutError:
                    raise asyncio.TimeoutError(
                        f"Tool '{tc.name}' timed out after {_TOOL_TIMEOUT}s"
                    )

            # return_exceptions=True: one failing tool returns its exception as a
            # Wall-clock per call, for the user-visible trace. Recorded in a
            # finally so a failing or timed-out tool still reports how long it
            # spent before giving up.
            call_durations: dict[int, int] = {}

            async def _run_one_timed(index: int, tc) -> str:
                started = time.monotonic()
                try:
                    return await _run_one(tc)
                finally:
                    call_durations[index] = int((time.monotonic() - started) * 1000)

            # value instead of cancelling sibling tasks. Order matches valid_tool_calls.
            raw_results = await asyncio.gather(
                *[_run_one_timed(i, tc) for i, tc in enumerate(valid_tool_calls)],
                return_exceptions=True,
            )

            tool_results: list[ToolResult] = []
            for i, (tc, raw) in enumerate(zip(valid_tool_calls, raw_results)):
                all_tool_calls[stub_start + i]["duration_ms"] = call_durations.get(i)
                if isinstance(raw, BaseException):
                    all_tool_calls[stub_start + i]["is_error"] = True
                    all_tool_calls[stub_start + i]["result"] = f"Error: {str(raw)}"
                    print(f"  {_R}[error] {tc.name} → {_trim(str(raw), 120)}{_X}")
                    tool_results.append(ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        content=f"Error executing tool: {str(raw)}",
                        is_error=True,
                    ))
                else:
                    # Backfill parsed result for action card detection
                    try:
                        all_tool_calls[stub_start + i]["result"] = json.loads(raw)
                    except Exception:
                        all_tool_calls[stub_start + i]["result"] = raw
                    result_str = raw
                    if len(result_str) > MAX_TOOL_RESULT_CHARS:
                        result_str = result_str[:MAX_TOOL_RESULT_CHARS] + "\n...[truncated]"
                    print(f"  {_G}[result] {tc.name} → {_trim(raw, 120)}{_X}")
                    tool_results.append(ToolResult(
                        tool_call_id=tc.id,
                        name=tc.name,
                        content=result_str,
                        is_error=False,
                    ))

            # Append tool call + results to messages for next iteration
            from core.tools import format_tool_result_messages
            from core.config import settings
            # In mock mode, always use OpenAI format for consistent detection
            provider_for_format = "openai" if settings.MOCK_MODE else self.default_provider
            result_messages = format_tool_result_messages(
                provider_for_format, valid_tool_calls, tool_results
            )
            messages.extend(result_messages)

        # Circuit breaker: exhausted iterations, force a final text completion
        print(f"  {_Y}[warn] circuit breaker hit — forcing final text completion{_X}")
        final_text = await self.llm.complete(
            provider=self.default_provider,
            model=self.default_model,
            system=system_prompt,
            messages=messages,
        )
        action_id_out, action_result = _pick_rich_result(all_tool_calls)
        elapsed = time.monotonic() - _turn_start
        print(
            f"  {_G}[done] circuit-breaker reply{_X}  "
            f"{_DIM}action={action_id_out or 'none'} | {elapsed:.2f}s{_X}"
        )
        return ChatSyncResponse(
            response=final_text,
            agent=self.slug,
            message_id=str(uuid.uuid4()),
            tokens_used=self.llm.count_tokens(final_text),
            model_used=self.default_model,
            metadata={
                "tool_calls": all_tool_calls,
                "max_iterations_reached": True,
                **({"pending_actions": mcp_pending_actions} if mcp_pending_actions else {}),
            },
            action_id=action_id_out,
            action_result=action_result,
            tool_trace=_build_tool_trace(
                all_tool_calls, mcp_alias_map, integration_by_connection, mcp_write_set
            ),
        )

    # ── MCP tool execution ───────────────────────────────────────────────

    async def _execute_mcp_tool(
        self,
        alias: str,
        arguments: dict,
        organization_id: str,
        alias_map: dict[str, tuple[str, str]],
    ) -> str:
        """Dispatch an MCP-sourced tool call. `alias_map` is the LOCAL map
        built this turn by get_mcp_tools() — never self.state (see chat_sync)."""
        connection_id, real_tool_name = alias_map[alias]
        try:
            result = await call_connection_tool(organization_id, connection_id, real_tool_name, arguments)
        except McpToolCallError as e:
            raise RuntimeError(str(e))
        return json.dumps(result)

    # ── Cross-agent execution ───────────────────────────────────────────

    async def _execute_cross_agent_call(
        self,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
        mcp_connections: list | None = None,
    ) -> str:
        """Execute a cross-agent call via the agent registry."""
        from agents.registry import get_agent

        target_slug = arguments.get("agent_slug", "")
        question = arguments.get("question", "")

        if target_slug == self.slug:
            return "Error: Cannot call yourself. Use your own tools instead."

        target_agent = get_agent(target_slug)
        if not target_agent:
            return f"Error: Agent '{target_slug}' not found or not registered."

        # Run target agent's full tool loop, but block further delegation via flag.
        # Pass mcp_connections through — otherwise a delegated call silently
        # loses MCP tool access. v1 does not re-filter by the target agent's
        # catalog ownership (Node already filtered for the outer agent before
        # this call happened); acceptable scoping nuance, not a security gap
        # since it can only ever be a subset of what the outer agent already had.
        inner_request = ChatRequest(
            user_id=user_id,
            organization_id=organization_id,
            conversation_id=f"cross-agent-{self.slug}-to-{target_slug}",
            message=question,
            history=[],
            metadata={
                "_cross_agent_call": True,
                **({"mcp_connections": mcp_connections} if mcp_connections else {}),
            },
        )
        result = await target_agent.chat_sync(inner_request)
        return result.response

    # ── Safe fire-and-forget RAG ingest ─────────────────────────────────

    def _fire_rag_ingest(
        self,
        user_id: str,
        text: str,
        source_id: str,
        metadata: dict | None = None,
    ) -> None:
        """Schedule RAG ingest without blocking the response. Logs failures."""
        task = asyncio.create_task(
            self.ingest_to_rag(user_id, text, source_id, metadata)
        )
        task.add_done_callback(
            lambda t: _log.error(
                "RAG ingest failed | agent=%s source=%s err=%s",
                self.slug, source_id, t.exception(),
            ) if not t.cancelled() and t.exception() is not None else None
        )

    # ── RAG ingestion ───────────────────────────────────────────────────

    async def ingest_to_rag(
        self,
        user_id: str,
        text: str,
        source_id: str,
        metadata: dict | None = None,
    ) -> int:
        return await self.rag.ingest(
            user_id=user_id,
            text=text,
            source_type="text",
            source_id=source_id,
            source_agent=self.slug,
            metadata=metadata,
        )
