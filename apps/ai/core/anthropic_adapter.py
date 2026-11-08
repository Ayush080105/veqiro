"""Boundary between the OpenAI-shaped messages the agents build and the Anthropic Messages API.

Agents, the run executor and stored conversation history all speak the OpenAI chat shape
(`role: "tool"`, `tool_calls`, `tool_call_id`). Rather than teach every caller a second
shape, the conversion happens here, at the moment a request is sent to Claude, and the
response is converted back into the types the rest of the code already uses.

Thinking blocks are deliberately never replayed: history is rebuilt from the OpenAI shape
on every turn, so it is not append-only, and replaying a thinking block after the history
changed is a 400 on newer accounts. Dropping them costs the model only its earlier private
reasoning, not any visible content.
"""

from __future__ import annotations

import json
from typing import Any

from core.config import settings
from core.exceptions import LLMRefusalError
from core.tools import ToolCall

# Replaces OpenAI's response_format={"type": "json_object"}. Parsing and the corrective
# retry stay in LLMClient.complete_json.
JSON_INSTRUCTION = "Respond with only a single valid JSON value. No prose, no markdown fences."

FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _as_text(content: Any) -> str:
    if content is None:
        return ""
    return content if isinstance(content, str) else str(content)


def _parse_arguments(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _convert(messages: list[dict]) -> list[dict]:
    """One pass: map each OpenAI message to an Anthropic one, merging consecutive tool results."""
    out: list[dict] = []
    for m in messages:
        role = m.get("role")
        if role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": m.get("tool_call_id", ""),
                "content": _as_text(m.get("content")),
            }
            prev = out[-1] if out else None
            if prev and prev["role"] == "user" and prev["content"] and all(
                b["type"] == "tool_result" for b in prev["content"]
            ):
                prev["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
            continue

        if role not in ("user", "assistant"):
            continue  # system prompt travels separately; anything else has no Anthropic analogue

        blocks: list[dict] = []
        text = _as_text(m.get("content"))
        if text.strip():
            blocks.append({"type": "text", "text": text})
        if role == "assistant":
            for tc in m.get("tool_calls") or []:
                fn = tc.get("function") or {}
                blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id", ""),
                    "name": fn.get("name", ""),
                    "input": _parse_arguments(fn.get("arguments")),
                })
        if blocks:
            out.append({"role": role, "content": blocks})
    return out


def _repair_tool_pairing(msgs: list[dict]) -> list[dict]:
    """Claude requires every tool_use to be answered by a tool_result in the very next user
    message, and every tool_result to answer a tool_use in the message right before it.
    Trimmed or partial history can break either side; drop the unpaired half."""
    for i, m in enumerate(msgs):
        if m["role"] == "assistant":
            nxt = msgs[i + 1] if i + 1 < len(msgs) else None
            answered = {
                b["tool_use_id"]
                for b in (nxt["content"] if nxt and nxt["role"] == "user" else [])
                if b["type"] == "tool_result"
            }
            m["content"] = [
                b for b in m["content"] if b["type"] != "tool_use" or b["id"] in answered
            ]
        elif m["role"] == "user":
            prev = msgs[i - 1] if i > 0 else None
            asked = {
                b["id"]
                for b in (prev["content"] if prev and prev["role"] == "assistant" else [])
                if b["type"] == "tool_use"
            }
            m["content"] = [
                b for b in m["content"] if b["type"] != "tool_result" or b["tool_use_id"] in asked
            ]
    return [m for m in msgs if m["content"]]


def to_anthropic_messages(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-shaped chat history to Anthropic `messages`.

    The result always starts with a user turn and never contains an empty block or an
    unpaired tool_use / tool_result.
    """
    msgs = _convert(messages)
    # Pairing is checked against the unmodified neighbours, so repair before trimming.
    msgs = _repair_tool_pairing(msgs)
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    # A dropped leading assistant turn can leave a tool_result whose tool_use is gone.
    return _repair_tool_pairing(msgs)


def _flatten_tool_blocks(msgs: list[dict]) -> list[dict]:
    """Rewrite tool_use / tool_result blocks as plain text.

    Claude rejects a request whose history holds tool blocks but which defines no tools,
    e.g. the agent tool loop's circuit breaker asking for a final text-only answer.
    The model still sees what was called and what came back."""
    out = []
    for m in msgs:
        blocks = []
        for b in m["content"]:
            if b["type"] == "tool_use":
                blocks.append({"type": "text", "text": f"[Called tool {b['name']} with {json.dumps(b['input'])}]"})
            elif b["type"] == "tool_result":
                blocks.append({"type": "text", "text": f"[Tool result]\n{b['content'] or '(empty)'}"})
            else:
                blocks.append(b)
        out.append({"role": m["role"], "content": blocks})
    return out


def request_kwargs(
    model: str,
    system: str,
    messages: list[dict],
    max_tokens: int | None,
    json_mode: bool,
    has_tools: bool = False,
) -> dict:
    """Keyword arguments for `client.beta.messages.stream(...)`.

    Never sets `temperature` (rejected by current Claude models) or `thinking` (adaptive is
    the default; "disabled" is rejected on Opus 5.5 / Sonnet 5.5). Thinking counts toward
    `max_tokens`, so short caller budgets are raised to ANTHROPIC_MIN_MAX_TOKENS.
    """
    kwargs: dict = {
        "model": model,
        "max_tokens": max(max_tokens or 0, settings.ANTHROPIC_MIN_MAX_TOKENS),
        "messages": (
            to_anthropic_messages(messages)
            if has_tools
            else _flatten_tool_blocks(to_anthropic_messages(messages))
        ),
        "output_config": {"effort": settings.ANTHROPIC_EFFORT},
    }
    system_text = (system or "").strip()
    if json_mode:
        system_text = f"{system_text}\n\n{JSON_INSTRUCTION}" if system_text else JSON_INSTRUCTION
    if system_text:
        kwargs["system"] = system_text
    if settings.ANTHROPIC_FALLBACKS:
        kwargs["betas"] = [FALLBACK_BETA]
        kwargs["fallbacks"] = "default"
    return kwargs


def raise_if_refused(message: Any) -> None:
    if getattr(message, "stop_reason", None) == "refusal":
        details = getattr(message, "stop_details", None)
        category = getattr(details, "category", None) if details else None
        raise LLMRefusalError(f"Claude declined the request (category={category})")


def read_response(message: Any) -> tuple[str, list[ToolCall], int, int]:
    """Text (from `text` blocks only), tool calls, input tokens, output tokens.

    Blocks are read by type: a response can begin with `thinking` blocks, whose text is
    empty by default and never shown to users.
    """
    raise_if_refused(message)
    texts: list[str] = []
    calls: list[ToolCall] = []
    for block in message.content or []:
        if block.type == "fallback":
            # Server-side fallback: everything before this block came from a model that
            # declined mid-answer. Keep only what the fallback model produced.
            texts, calls = [], []
        elif block.type == "text":
            texts.append(block.text)
        elif block.type == "tool_use":
            calls.append(ToolCall(id=block.id, name=block.name, arguments=dict(block.input or {})))
    usage = getattr(message, "usage", None)
    return (
        "".join(texts),
        calls,
        getattr(usage, "input_tokens", 0) or 0,
        getattr(usage, "output_tokens", 0) or 0,
    )
