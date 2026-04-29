import json
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from core.config import settings
from core.conversation_memory import store_turn, retrieve_relevant
from core.llm import LLMClient
from core.models import Message
from core.utils import safe_json_loads

router = APIRouter(prefix="/ai/context", tags=["Context"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class BuildContextRequest(BaseModel):
    user_message: str
    hot_history: list[Message] = []
    running_summary: str = ""
    org_summary: str = ""
    long_term_facts: list[str] = []
    org_id: str
    agent: str


class BuildContextResponse(BaseModel):
    hot_messages: list[Message]
    semantic_messages: list[Message]
    memory_block: str


class StoreTurnRequest(BaseModel):
    org_id: str
    agent: str
    user_content: str
    assistant_content: str
    metadata: dict = Field(default_factory=dict)


class SummarizeRequest(BaseModel):
    org_id: str
    agent: str
    recent_messages: list[Message]
    existing_summary: str = ""
    agent_role: str


class SummarizeResponse(BaseModel):
    updated_summary: str
    extracted_facts: list[str]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/build", response_model=BuildContextResponse, summary="Build conversation context")
async def build_context(request: BuildContextRequest) -> BuildContextResponse:
    """Assemble hot history, semantic memories, and memory block for a conversation turn."""
    hot = request.hot_history[-3:]

    semantic = await retrieve_relevant(
        request.org_id, request.agent, request.user_message, top_k=5
    )

    hot_contents = {m.content for m in hot}
    deduped_semantic = [
        Message(role=r["role"], content=r["content"])
        for r in semantic
        if r["content"] not in hot_contents
    ]

    parts = []
    if request.running_summary:
        parts.append(f"Agent memory: {request.running_summary}")
    if request.org_summary:
        parts.append(f"Organization context: {request.org_summary}")
    if request.long_term_facts:
        facts_lines = "\n".join(f"- {f}" for f in request.long_term_facts[:8])
        parts.append(f"Key facts:\n{facts_lines}")
    memory_block = "\n\n".join(parts)

    return BuildContextResponse(
        hot_messages=hot,
        semantic_messages=deduped_semantic,
        memory_block=memory_block,
    )


@router.post("/store-turn", status_code=204, summary="Store a conversation turn")
async def store_conversation_turn(request: StoreTurnRequest) -> None:
    """Embed and persist a user+assistant turn pair to long-term memory."""
    await store_turn(
        request.org_id,
        request.agent,
        request.user_content,
        request.assistant_content,
        request.metadata,
    )


@router.post("/summarize", response_model=SummarizeResponse, summary="Summarize conversation and extract facts")
async def summarize_conversation(request: SummarizeRequest) -> SummarizeResponse:
    """Merge recent messages into a rolling summary and extract long-term facts."""
    if settings.MOCK_MODE:
        return SummarizeResponse(
            updated_summary=request.existing_summary,
            extracted_facts=[],
        )

    system = (
        "You are a conversation summarizer. Given an existing summary and recent messages, "
        "produce: (1) updated_summary merging old + new context (max 400 words), "
        "(2) extracted_facts: list of important new facts or decisions worth remembering long-term. "
        'Output strict JSON only: {"updated_summary": "...", "extracted_facts": ["..."]}'
    )
    user_prompt = (
        f"EXISTING_SUMMARY: {request.existing_summary or 'None'}\n"
        f"AGENT_ROLE: {request.agent_role}\n"
        f"RECENT_MESSAGES:\n{json.dumps([m.model_dump() for m in request.recent_messages])}"
    )

    llm = LLMClient()
    raw = await llm.complete(
        provider="openai",
        model="gpt-4o-mini",
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
        temperature=0.2,
        max_tokens=800,
    )

    try:
        data = safe_json_loads(raw)
        return SummarizeResponse(
            updated_summary=data.get("updated_summary", request.existing_summary),
            extracted_facts=data.get("extracted_facts", []),
        )
    except Exception as exc:
        logger.warning("summarize_conversation: JSON parse failed, returning existing summary", exc_info=True)
        return SummarizeResponse(
            updated_summary=request.existing_summary,
            extracted_facts=[],
        )
