"""OpenAI-shaped history and tool definitions -> Anthropic Messages API shapes."""

import json

from core.anthropic_adapter import to_anthropic_messages
from core.tools import (
    ToolCall,
    ToolDefinition,
    ToolParameter,
    ToolResult,
    _params_to_json_schema,
    format_tool_result_messages,
    tool_defs_to_anthropic,
)


def _text(t):
    return [{"type": "text", "text": t}]


def _assistant_tool_turn(*calls):
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}
            for cid, name, args in calls
        ],
    }


def test_plain_turns():
    out = to_anthropic_messages([
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "yo"},
        {"role": "user", "content": "again"},
    ])
    assert out == [
        {"role": "user", "content": _text("hi")},
        {"role": "assistant", "content": _text("yo")},
        {"role": "user", "content": _text("again")},
    ]


def test_tool_round_trip():
    out = to_anthropic_messages([
        {"role": "user", "content": "find x"},
        _assistant_tool_turn(("tc_1", "search", {"q": "x"})),
        {"role": "tool", "tool_call_id": "tc_1", "content": "r"},
    ])
    assert out[1] == {
        "role": "assistant",
        "content": [{"type": "tool_use", "id": "tc_1", "name": "search", "input": {"q": "x"}}],
    }
    assert out[2] == {
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": "tc_1", "content": "r"}],
    }


def test_assistant_text_kept_before_tool_use():
    turn = _assistant_tool_turn(("tc_1", "search", {}))
    turn["content"] = "Let me look."
    out = to_anthropic_messages([
        {"role": "user", "content": "q"}, turn,
        {"role": "tool", "tool_call_id": "tc_1", "content": "r"},
    ])
    assert out[1]["content"][0] == {"type": "text", "text": "Let me look."}
    assert out[1]["content"][1]["type"] == "tool_use"


def test_parallel_tool_results_merge():
    out = to_anthropic_messages([
        {"role": "user", "content": "q"},
        _assistant_tool_turn(("a", "one", {}), ("b", "two", {})),
        {"role": "tool", "tool_call_id": "a", "content": "ra"},
        {"role": "tool", "tool_call_id": "b", "content": "rb"},
    ])
    assert len(out) == 3
    assert [b["tool_use_id"] for b in out[2]["content"]] == ["a", "b"]
    assert out[2]["role"] == "user"


def test_bad_tool_arguments_become_empty_input():
    turn = _assistant_tool_turn(("tc_1", "search", {}))
    turn["tool_calls"][0]["function"]["arguments"] = "{not json"
    out = to_anthropic_messages([
        {"role": "user", "content": "q"}, turn,
        {"role": "tool", "tool_call_id": "tc_1", "content": "r"},
    ])
    assert out[1]["content"][0]["input"] == {}


def test_leading_assistant_dropped():
    out = to_anthropic_messages([
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "q"},
    ])
    assert out == [{"role": "user", "content": _text("q")}]


def test_empty_assistant_text_skipped():
    out = to_anthropic_messages([
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": ""},
        {"role": "user", "content": "q2"},
    ])
    assert [m["role"] for m in out] == ["user", "user"]


def test_non_string_content_is_stringified():
    out = to_anthropic_messages([{"role": "user", "content": {"k": 1}}])
    assert out[0]["content"][0]["type"] == "text"
    assert "k" in out[0]["content"][0]["text"]


def test_system_messages_are_ignored_in_history():
    out = to_anthropic_messages([
        {"role": "system", "content": "s"},
        {"role": "user", "content": "q"},
    ])
    assert out == [{"role": "user", "content": _text("q")}]


def test_orphan_tool_result_dropped():
    # History trimmed so the tool call is gone but its result survived.
    out = to_anthropic_messages([
        {"role": "user", "content": "q"},
        {"role": "tool", "tool_call_id": "gone", "content": "r"},
        {"role": "user", "content": "q2"},
    ])
    assert out == [
        {"role": "user", "content": _text("q")},
        {"role": "user", "content": _text("q2")},
    ]


def test_tool_use_without_result_dropped():
    # A tool call whose result never made it into history.
    turn = _assistant_tool_turn(("tc_1", "search", {}))
    turn["content"] = "Checking."
    out = to_anthropic_messages([
        {"role": "user", "content": "q"},
        turn,
        {"role": "user", "content": "q2"},
    ])
    assert out[1] == {"role": "assistant", "content": _text("Checking.")}
    assert out[2] == {"role": "user", "content": _text("q2")}


def test_tool_defs_raw_schema_verbatim():
    schema = {"type": "object", "properties": {"page": {"type": "object"}}, "required": []}
    t = ToolDefinition(name="notion_create", description="d", raw_schema=schema)
    assert tool_defs_to_anthropic([t]) == [
        {"name": "notion_create", "description": "d", "input_schema": schema}
    ]


def test_tool_defs_from_parameters():
    params = [ToolParameter(name="q", type="string", description="query")]
    t = ToolDefinition(name="search", description="d", parameters=params)
    assert tool_defs_to_anthropic([t])[0]["input_schema"] == _params_to_json_schema(params)


def test_anthropic_tool_results_stay_openai_shaped():
    calls = [ToolCall(id="tc_1", name="search", arguments={"q": "x"})]
    results = [ToolResult(tool_call_id="tc_1", name="search", content="r")]
    msgs = format_tool_result_messages("anthropic", calls, results)
    assert msgs[0]["role"] == "assistant" and msgs[0]["tool_calls"][0]["id"] == "tc_1"
    assert msgs[1] == {"role": "tool", "tool_call_id": "tc_1", "content": "r"}


def test_tool_history_without_tools_is_flattened_to_text():
    # The tool-loop circuit breaker asks for a final text answer over a history that
    # holds tool calls, without passing tools; Claude rejects tool blocks with no tools.
    from core.anthropic_adapter import request_kwargs

    kw = request_kwargs("claude-opus-5-5", "s", [
        {"role": "user", "content": "find x"},
        _assistant_tool_turn(("tc_1", "search", {"q": "x"})),
        {"role": "tool", "tool_call_id": "tc_1", "content": "result-r"},
    ], None, json_mode=False)
    types = [b["type"] for m in kw["messages"] for b in m["content"]]
    assert "tool_use" not in types and "tool_result" not in types
    flat = json.dumps(kw["messages"])
    assert "search" in flat and "result-r" in flat
    assert kw["messages"][0]["role"] == "user"


def test_tool_history_kept_as_blocks_when_tools_are_sent():
    from core.anthropic_adapter import request_kwargs

    kw = request_kwargs("claude-opus-5-5", "s", [
        {"role": "user", "content": "find x"},
        _assistant_tool_turn(("tc_1", "search", {"q": "x"})),
        {"role": "tool", "tool_call_id": "tc_1", "content": "r"},
    ], None, json_mode=False, has_tools=True)
    assert kw["messages"][1]["content"][0]["type"] == "tool_use"


def test_only_content_after_a_fallback_block_is_kept():
    from types import SimpleNamespace as N

    from core.anthropic_adapter import read_response

    msg = N(
        content=[
            N(type="text", text="partial from declined model"),
            N(type="tool_use", id="t_bad", name="x", input={}),
            N(type="fallback"),
            N(type="text", text="full answer"),
        ],
        stop_reason="end_turn", stop_details=None,
        usage=N(input_tokens=1, output_tokens=1),
    )
    text, calls, _, _ = read_response(msg)
    assert text == "full answer"
    assert calls == []
