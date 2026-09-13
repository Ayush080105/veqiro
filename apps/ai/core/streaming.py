import json
import re
import uuid
from typing import AsyncGenerator


def token_event(text: str, agent: str) -> dict:
    return {"event": "token", "data": json.dumps({"text": text, "agent": agent})}


def metadata_event(data: dict) -> dict:
    return {"event": "metadata", "data": json.dumps(data)}


def done_event(
    message_id: str,
    tokens_used: int,
    model_used: str,
    extra: dict | None = None,
) -> dict:
    payload = {"message_id": message_id, "tokens_used": tokens_used, "model_used": model_used}
    if extra:
        payload.update(extra)
    return {"event": "done", "data": json.dumps(payload)}


def error_event(message: str, code: str) -> dict:
    return {"event": "error", "data": json.dumps({"message": message, "code": code})}


def image_event(url: str, alt: str, prompt_used: str) -> dict:
    return {
        "event": "image",
        "data": json.dumps({"url": url, "alt": alt, "prompt_used": prompt_used}),
    }


def tool_call_event(name: str, arguments: dict, agent: str) -> dict:
    """A tool call was issued this turn — lets the UI show live progress
    ("Calling Gmail...") during the silent portion of a tool-calling turn,
    before any reply text exists yet."""
    return {
        "event": "tool_call",
        "data": json.dumps({"name": name, "arguments": arguments, "agent": agent}),
    }


def tool_result_event(name: str, ok: bool, agent: str) -> dict:
    return {
        "event": "tool_result",
        "data": json.dumps({"name": name, "ok": ok, "agent": agent}),
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


# Word-plus-trailing-whitespace chunks; concatenating every match reproduces
# the original string exactly, so "chunk-replay" streaming can't corrupt text.
_WORD_CHUNK_RE = re.compile(r"\S+\s*")


async def stream_chat_sync_response(
    tool_loop: AsyncGenerator[dict, None],
    agent_slug: str,
) -> AsyncGenerator[dict, None]:
    """Adapts a `BaseAgent.chat_sync_stream` event generator into wire-shaped
    SSE events: live `tool_call`/`tool_result` events pass straight through,
    then the final answer is chunk-replayed through `token_event` (the tool
    loop's own LLM call is not itself streamed — see chat_sync_stream's
    docstring for why), and a `done_event` closes the turn carrying the same
    fields `ChatSyncResponse` exposes so the caller can persist a message
    identical to what the non-streaming endpoint would have returned.
    """
    final_response = None

    # A mid-stream exception can't become an HTTP 500 once SSE headers have
    # gone out — the connection is already committed to text/event-stream —
    # so it's turned into an error_event here instead of propagating and
    # leaving the client with a silently truncated stream.
    try:
        async for event in tool_loop:
            kind = event.get("type")
            if kind == "tool_call":
                yield tool_call_event(event["name"], event.get("arguments") or {}, agent_slug)
            elif kind == "tool_result":
                yield tool_result_event(event["name"], bool(event.get("ok")), agent_slug)
            elif kind == "final":
                final_response = event["response"]
    except Exception as e:
        yield error_event(str(e), "stream_error")
        return

    if final_response is None:
        yield error_event("Agent produced no response.", "no_final_event")
        return

    text = final_response.response or ""
    for match in _WORD_CHUNK_RE.finditer(text):
        yield token_event(match.group(0), agent_slug)

    yield done_event(
        final_response.message_id,
        final_response.tokens_used,
        final_response.model_used,
        extra={
            "metadata": final_response.metadata,
            "action_id": final_response.action_id,
            "action_result": final_response.action_result,
            "tool_trace": final_response.tool_trace,
            "image": final_response.image.model_dump() if final_response.image else None,
        },
    )


def sse_format(events: AsyncGenerator[dict, None]) -> AsyncGenerator[str, None]:
    """Renders `{"event": ..., "data": ...}` dicts as wire-format SSE text for
    FastAPI's StreamingResponse (media_type="text/event-stream")."""
    async def _formatted() -> AsyncGenerator[str, None]:
        async for evt in events:
            yield f"event: {evt['event']}\ndata: {evt['data']}\n\n"
    return _formatted()
