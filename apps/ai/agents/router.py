from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from core.config import settings
from core.llm import LLMClient, GPT4O_MINI

router = APIRouter(prefix="/ai/router", tags=["Router"])

_KEYWORD_MAP = {
    "maya": ["content", "post", "social", "marketing", "caption", "blog", "write", "linkedin", "instagram", "twitter"],
    "rex": ["analytics", "data", "metrics", "revenue", "finance", "forecast", "numbers", "mrr", "arr", "kpi"],
    "scout": ["research", "competitor", "market", "trends", "industry", "investigate", "analysis"],
    "sage": ["seo", "keyword", "blog", "wordpress", "organic", "ranking", "search", "traffic"],
    "lex": ["legal", "contract", "nda", "terms", "privacy", "compliance", "document", "agreement"],
    "vega": ["email", "calendar", "schedule", "meeting", "inbox", "reply", "draft", "gmail"],
}

# Capability descriptions for the LLM classifier — what each agent actually DOES,
# not a keyword list, so the model routes by intent rather than surface matches.
_AGENT_CAPABILITIES = {
    "maya": "creates social media content: posts, captions, content ideas, images, carousels, ad campaigns, and short videos for LinkedIn/Instagram/X",
    "rex": "financial analysis: revenue/MRR/ARR metrics, churn, runway, forecasting, unit economics, scenario planning, investor updates",
    "scout": "market research and competitive intelligence: competitor profiles, market trends, industry analysis, sourced research",
    "sage": "SEO and organic growth: keyword research, blog writing, site/page audits, rankings, WordPress publishing",
    "lex": "legal and compliance: contract review and drafting, NDAs, terms of service, privacy policies, legal research",
    "vega": "executive assistant: Gmail inbox triage, email drafting/replies, calendar and meeting scheduling, daily briefings",
}


class ClassifyRequest(BaseModel):
    user_id: str
    message: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "message": "Help me write a LinkedIn post about our Series A funding",
            }
        }
    )


class ClassifyResponse(BaseModel):
    agent_slug: str
    confidence: float
    reasoning: str
    tokens_used: int = 0
    model_used: str = ""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "agent_slug": "maya",
                "confidence": 0.92,
                "reasoning": "Message contains keywords related to content creation and LinkedIn posting.",
                "tokens_used": 148,
                "model_used": "gpt-5.6-luna",
            }
        }
    )


def _keyword_classify(message: str) -> ClassifyResponse:
    message_lower = message.lower()
    scores: dict[str, int] = {}
    for agent, keywords in _KEYWORD_MAP.items():
        hit = sum(1 for k in keywords if k in message_lower)
        if hit:
            scores[agent] = hit

    if not scores:
        return ClassifyResponse(
            agent_slug="maya",
            confidence=0.5,
            reasoning="No strong keyword signals found; defaulting to Maya (content agent).",
        )

    best_agent = max(scores, key=lambda a: scores[a])
    total_hits = sum(scores.values())
    confidence = round(scores[best_agent] / max(total_hits, 1), 2)
    matched_keywords = [k for k in _KEYWORD_MAP[best_agent] if k in message_lower]
    # +0.25 (not +0.4): a single keyword hit shouldn't report near-certainty.
    return ClassifyResponse(
        agent_slug=best_agent,
        confidence=min(confidence + 0.25, 0.95),
        reasoning=f"Matched keywords: {', '.join(matched_keywords)}",
    )


@router.post("/classify", response_model=ClassifyResponse, summary="Classify message to agent")
async def classify_message(request: ClassifyRequest) -> ClassifyResponse:
    """Classify a user message and route to the most appropriate AI agent."""
    if settings.MOCK_MODE:
        return _keyword_classify(request.message)

    llm = LLMClient()
    provider, model = GPT4O_MINI
    agent_list = "\n".join(
        f"- {agent}: {desc}" for agent, desc in _AGENT_CAPABILITIES.items()
    )
    system = (
        "You are a routing classifier. Given a user message, determine which AI agent should handle it "
        "based on the user's INTENT — what they want done, not which words they used.\n"
        f"Available agents and what each one does:\n{agent_list}\n\n"
        "If the message fits several agents, pick the one whose core job matches the primary action requested. "
        "If nothing fits, pick maya with low confidence.\n"
        "Respond in JSON: {\"agent_slug\": \"...\", \"confidence\": 0.0-1.0, \"reasoning\": \"...\"}"
    )
    messages = [{"role": "user", "content": request.message}]
    try:
        data = await llm.complete_json(
            provider=provider, model=model, system=system, messages=messages,
            temperature=0.1,
        )
        tokens_used = llm.count_tokens(str(data))
        return ClassifyResponse(**data, tokens_used=tokens_used, model_used=model)
    except Exception:
        return _keyword_classify(request.message)
