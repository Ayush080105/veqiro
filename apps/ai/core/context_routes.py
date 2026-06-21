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
    org_shared_context: str = ""   # goals, product, decisions from OrgMemory.sharedMemory
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
    # Last 8 messages (history arrives in ASC order from server after the ordering fix)
    hot = request.hot_history[-8:]

    semantic = await retrieve_relevant(
        request.org_id, request.agent, request.user_message, top_k=5
    )

    hot_contents = {m.content for m in hot}
    deduped_semantic = [
        Message(role=r["role"], content=r["content"])
        for r in semantic
        if r["content"] not in hot_contents
    ]

    # Build a well-structured memory block the LLM can read clearly
    parts = []
    if request.running_summary:
        parts.append(f"## What I Remember About This Client\n{request.running_summary}")
    if request.org_summary:
        parts.append(f"## Organization Context\n{request.org_summary}")
    if request.org_shared_context:
        parts.append(f"## Organization Goals & Decisions\n{request.org_shared_context}")
    if request.long_term_facts:
        # Show the 12 most recent facts (tail of array = most recently added)
        recent_facts = request.long_term_facts[-12:]
        facts_lines = "\n".join(f"• {f}" for f in recent_facts)
        parts.append(f"## Established Facts\n{facts_lines}")
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
        "You are a memory manager for an AI agent assistant. "
        "Given an existing summary and recent conversation messages, produce:\n"
        "1. updated_summary: rolling summary merging old + new context (max 400 words, present tense, "
        "focus on what the client is building, their goals, and recent decisions).\n"
        "2. extracted_facts: list of ONLY new, concrete, actionable facts worth keeping long-term. "
        "Prefix each with a category tag: [DECISION], [METRIC], [PREFERENCE], [CONTEXT], or [GOAL]. "
        "Examples: '[DECISION] Targeting LinkedIn over Twitter', '[METRIC] MRR is $12k as of Oct 2025', "
        "'[PREFERENCE] Prefers short posts under 150 words', '[GOAL] Launch paid tier by Q1 2026'. "
        "Skip vague observations. Max 5 facts per call. Only include genuinely new information not in existing_summary.\n"
        'Output strict JSON only: {"updated_summary": "...", "extracted_facts": ["[TAG] fact..."]}'
    )
    user_prompt = (
        f"EXISTING_SUMMARY: {request.existing_summary or 'None'}\n"
        f"AGENT_ROLE: {request.agent_role}\n"
        f"RECENT_MESSAGES:\n{json.dumps([m.model_dump() for m in request.recent_messages])}"
    )

    llm = LLMClient()
    raw = await llm.complete(
        provider="openai",
        model="gpt-4.1-mini",
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
