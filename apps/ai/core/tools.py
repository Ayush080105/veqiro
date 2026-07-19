"""Tool-calling data structures and provider format converters."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


# ── Data Structures ─────────────────────────────────────────────────────────


class ToolParameter(BaseModel):
    name: str
    type: str  # "string" | "integer" | "number" | "boolean" | "array" | "object"
    description: str
    required: bool = True
    enum: list[str] | None = None
    default: Any = None
    items_type: str | None = None  # for array type: element type


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: list[ToolParameter] = []
    # MCP tools speak JSON Schema natively (inputSchema) and can be nested
    # (e.g. Notion's create_page). ToolParameter is flat and can't represent
    # that — when set, converters below use this verbatim instead of the
    # lossy JSON-Schema -> ToolParameter -> JSON-Schema round trip.
    raw_schema: dict | None = None


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: f"tc_{uuid.uuid4().hex[:12]}")
    name: str
    arguments: dict = {}


class ToolResult(BaseModel):
    tool_call_id: str
    name: str
    content: str
    is_error: bool = False


class LLMToolResponse(BaseModel):
    content: str | None = None
    tool_calls: list[ToolCall] = []
    finish_reason: str = "stop"  # "stop" | "tool_calls"


# ── Provider Format Converters ──────────────────────────────────────────────


def _params_to_json_schema(params: list[ToolParameter], include_defaults: bool = True) -> dict:
    """Convert ToolParameter list to JSON Schema properties dict."""
    properties = {}
    required = []
    for p in params:
        prop: dict[str, Any] = {"type": p.type, "description": p.description}
        if p.enum:
            prop["enum"] = p.enum
        if p.type == "array" and p.items_type:
            prop["items"] = {"type": p.items_type}
        if include_defaults and p.default is not None:
            prop["default"] = p.default
        properties[p.name] = prop
        if p.required:
            required.append(p.name)
    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }


def tool_defs_to_openai(tools: list[ToolDefinition]) -> list[dict]:
    """Convert tool definitions to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.raw_schema if t.raw_schema is not None else _params_to_json_schema(t.parameters),
            },
        }
        for t in tools
    ]


def tool_defs_to_gemini(tools: list[ToolDefinition]) -> list[dict]:
    """Convert tool definitions to Gemini function declaration format."""
    declarations = []
    for t in tools:
        schema = t.raw_schema if t.raw_schema is not None else _params_to_json_schema(t.parameters, include_defaults=False)
        declarations.append({
            "name": t.name,
            "description": t.description,
            "parameters": schema,
        })
    return declarations


# ── Tool Result Message Formatters ──────────────────────────────────────────


def tool_results_to_openai(
    tool_calls: list[ToolCall],
    results: list[ToolResult],
) -> list[dict]:
    """Format tool calls + results as OpenAI messages for the next LLM turn."""
    messages = []
    # First: the assistant message with tool_calls
    messages.append({
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.name,
                    "arguments": __import__("json").dumps(tc.arguments),
                },
            }
            for tc in tool_calls
        ],
    })
    # Then: one tool message per result
    for r in results:
        messages.append({
            "role": "tool",
            "tool_call_id": r.tool_call_id,
            "content": r.content,
        })
    return messages


def tool_results_to_gemini(
    tool_calls: list[ToolCall],
    results: list[ToolResult],
) -> list[dict]:
    """Format tool results for Gemini function response."""
    # Gemini uses Part-based function responses
    function_responses = []
    for tc, r in zip(tool_calls, results):
        function_responses.append({
            "name": tc.name,
            "response": {"result": r.content, "is_error": r.is_error},
        })
    return function_responses


def format_tool_result_messages(
    provider: str,
    tool_calls: list[ToolCall],
    results: list[ToolResult],
) -> list[dict]:
    """Route to the correct provider formatter."""
    if provider == "openai":
        return tool_results_to_openai(tool_calls, results)
    elif provider == "gemini":
        # Gemini handled differently in the LLM client (uses chat session)
        return tool_results_to_gemini(tool_calls, results)
    else:
        return tool_results_to_openai(tool_calls, results)
