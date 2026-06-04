import asyncio
import json
import uuid
from abc import ABC
from typing import AsyncGenerator

from core.llm import LLMClient
from core.observability import set_llm_context
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolCall, ToolResult

MAX_TOOL_RESULT_CHARS = 10000

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
    # Vega
    "process_inbox":            "vega:process-inbox",
    "draft_reply":              "vega:draft-reply",
    "calendar_summary":         "vega:calendar-summary",
    "create_event":             "vega:create-event",
    "executive_briefing":       "vega:executive-briefing",
    "compose_email":            "vega:compose-email",
}


def _pick_rich_result(tool_calls: list[dict]) -> tuple[str | None, dict | None]:
    """Return (action_id, result_dict) for the last rich tool call that produced a dict result."""
    for tc in reversed(tool_calls):
        mapped = RICH_TOOL_TO_ACTION_ID.get(tc.get("name", ""))
        if mapped and isinstance(tc.get("result"), dict):
            return mapped, tc["result"]
    return None, None


class BaseAgent(ABC):
    slug: str = "base"
    name: str = "Base Agent"
    default_provider: str = "openai"
    default_model: str = "gpt-4o-mini"
    personality: str = "Helpful AI assistant"

    MAX_TOOL_CALLS = 5  # Circuit breaker for tool-calling loop

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        self.llm = llm_client
        self.rag = rag_service

    # ── Tool-use instructions (override in subclass for stricter behaviour) ─

    def get_tool_instructions(self) -> str:
        return (
            "\n\nYou have access to specialized tools. Use them when the user's request "
            "would benefit from structured data, analysis, or actions. For simple conversational "
            "questions, respond directly without using tools. When using tools, synthesize "
            "the results into a helpful, natural response."
        )

    # ── Tool definitions (override in subclass) ─────────────────────────

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
    ) -> str:
        # Subclasses override this to inject brand_kit context. The base prompt
        # is intentionally minimal so the registry/cross-agent fallbacks don't
        # eagerly hit the brand-kit fetch.
        prompt = f"You are {self.name}, {self.personality}.\n\n"
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        prompt += (
            "\n\nHOW TO RESPOND:\n"
            "Lead with the answer — no preamble, no 'Great question!', no 'Certainly!', no 'I'd be happy to'.\n"
            "Write like a smart teammate messaging on Slack: direct, human, zero corporate fluff.\n"
            "Keep it tight — if 2 sentences work, don't write 5. Match the user's energy and detail level.\n"
            "For numbers and data: headline figure first, context second.\n"
            "Never say 'As an AI', 'I should note', or use filler transitions like 'It's worth mentioning'.\n"
        )
        return prompt

    # ── Streaming (unchanged, no tool calling) ──────────────────────────

    async def chat_stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Full pipeline: brand_kit -> RAG -> prompt -> stream LLM."""
        set_llm_context(
            org_id=request.organization_id,
            agent_slug=self.slug,
            conversation_id=request.conversation_id,
        )
        system_prompt = await self.build_system_prompt(request.user_id, request.organization_id)

        # RAG retrieval
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
        set_llm_context(
            org_id=request.organization_id,
            agent_slug=self.slug,
            conversation_id=request.conversation_id,
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

        # If no tools defined (shouldn't happen, but safety), fall back
        if len(tools) <= 1:  # only ask_agent
            return await self._chat_sync_no_tools(request)

        # Build system prompt with RAG (skip brand kit for internal cross-agent calls)
        is_cross_agent = request.metadata.get("_cross_agent_call", False)
        system_prompt = await self.build_system_prompt(
            request.user_id, request.organization_id,
            use_brand_kit=not is_cross_agent,
        )

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
            system_prompt += f"\n\n{memory_context}"

        # Add tool-use instructions to system prompt
        system_prompt += self.get_tool_instructions()

        messages = [
            {"role": m.role, "content": m.content} for m in request.history
        ] + [{"role": "user", "content": request.message}]

        all_tool_calls: list[dict] = []

        for _iteration in range(self.MAX_TOOL_CALLS):
            response = await self.llm.complete_with_tools(
                provider=self.default_provider,
                model=self.default_model,
                system=system_prompt,
                messages=messages,
                tools=tools,
            )

            if response.finish_reason == "stop":
                # LLM gave a final text answer
                full_text = response.content or ""
                tokens_used = self.llm.count_tokens(full_text)
                metadata: dict = {}
                if all_tool_calls:
                    metadata["tool_calls"] = all_tool_calls
                # Surface the last rich tool result as a card payload
                action_id_out, action_result = _pick_rich_result(all_tool_calls)
                return ChatSyncResponse(
                    response=full_text,
                    agent=self.slug,
                    message_id=str(uuid.uuid4()),
                    tokens_used=tokens_used,
                    model_used=self.default_model,
                    metadata=metadata,
                    action_id=action_id_out,
                    action_result=action_result,
                )

            # Execute tool calls — all concurrently, preserving order.
            # Append stub entries first so indices are stable, then backfill
            # the parsed result after gather.
            stub_start = len(all_tool_calls)
            for tc in response.tool_calls:
                all_tool_calls.append({
                    "id": tc.id,
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "result": None,
                })

            async def _run_one(tc) -> str:
                if tc.name == "ask_agent":
                    return await self._execute_cross_agent_call(
                        tc.arguments, request.user_id, request.organization_id
                    )
                return await self.execute_tool(
                    tc.name, tc.arguments, request.user_id, request.organization_id
                )

            # return_exceptions=True: one failing tool returns its exception as a
            # value instead of cancelling sibling tasks. Order matches tool_calls.
            raw_results = await asyncio.gather(
                *[_run_one(tc) for tc in response.tool_calls],
                return_exceptions=True,
            )

            tool_results: list[ToolResult] = []
            for i, (tc, raw) in enumerate(zip(response.tool_calls, raw_results)):
                if isinstance(raw, BaseException):
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
                provider_for_format, response.tool_calls, tool_results
            )
            messages.extend(result_messages)

        # Circuit breaker: exhausted iterations, force a final text completion
        final_text = await self.llm.complete(
            provider=self.default_provider,
            model=self.default_model,
            system=system_prompt,
            messages=messages,
        )
        action_id_out, action_result = _pick_rich_result(all_tool_calls)
        return ChatSyncResponse(
            response=final_text,
            agent=self.slug,
            message_id=str(uuid.uuid4()),
            tokens_used=self.llm.count_tokens(final_text),
            model_used=self.default_model,
            metadata={
                "tool_calls": all_tool_calls,
                "max_iterations_reached": True,
            },
            action_id=action_id_out,
            action_result=action_result,
        )

    # ── Cross-agent execution ───────────────────────────────────────────

    async def _execute_cross_agent_call(
        self,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
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

        # Run target agent's full tool loop, but block further delegation via flag
        inner_request = ChatRequest(
            user_id=user_id,
            organization_id=organization_id,
            conversation_id=f"cross-agent-{self.slug}-to-{target_slug}",
            message=question,
            history=[],
            metadata={"_cross_agent_call": True},
        )
        result = await target_agent.chat_sync(inner_request)
        return result.response

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
