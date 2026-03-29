import json
import uuid
from typing import AsyncGenerator


def token_event(text: str, agent: str) -> dict:
    return {"event": "token", "data": json.dumps({"text": text, "agent": agent})}


def metadata_event(data: dict) -> dict:
    return {"event": "metadata", "data": json.dumps(data)}


def done_event(message_id: str, tokens_used: int, model_used: str) -> dict:
    return {
        "event": "done",
        "data": json.dumps({"message_id": message_id, "tokens_used": tokens_used, "model_used": model_used}),
    }


def error_event(message: str, code: str) -> dict:
    return {"event": "error", "data": json.dumps({"message": message, "code": code})}


def image_event(url: str, alt: str, prompt_used: str) -> dict:
    return {
        "event": "image",
        "data": json.dumps({"url": url, "alt": alt, "prompt_used": prompt_used}),
    }


async def stream_agent_response(
    generator: AsyncGenerator[str, None],
    agent_slug: str,
    extra_metadata: dict | None = None,
) -> AsyncGenerator[dict, None]:
    """Wraps a token generator into SSE-formatted events."""
    message_id = str(uuid.uuid4())
    total_text = ""

    if extra_metadata:
        yield metadata_event(extra_metadata)

    async for token in generator:
        total_text += token
        yield token_event(token, agent_slug)

    # Approximate token count: 1 token ~ 4 chars
    tokens_used = max(1, len(total_text) // 4)
    yield done_event(message_id, tokens_used, agent_slug)
