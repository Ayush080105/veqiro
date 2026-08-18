"""Covers the user-visible tool trace built on every chat turn (base.py's
_build_tool_trace and helpers). These run without an LLM, a provider, or a
network call — the trace is pure formatting over the turn's tool-call log."""

import json

from agents.base import _build_tool_trace, _trace_action_label, _trace_detail


# ── Label: strip the toolkit prefix so the UI reads "Gmail · Fetch Emails" ──
# Composio's tool slugs and our catalog slugs don't segment the same way, so
# each of these shapes is a distinct code path, not a repetition.

def test_label_strips_single_word_prefix():
    assert _trace_action_label("GMAIL_FETCH_EMAILS", "gmail") == "Fetch Emails"


def test_label_strips_prefix_joined_into_one_word():
    # Catalog slug "google-calendar" vs. tool prefix GOOGLECALENDAR_
    assert _trace_action_label("GOOGLECALENDAR_FIND_EVENT", "google-calendar") == "Find Event"


def test_label_strips_prefix_spanning_two_words():
    # Catalog slug "microsoft-teams" vs. tool prefix MICROSOFT_TEAMS_
    assert _trace_action_label("MICROSOFT_TEAMS_SEND", "microsoft-teams") == "Send"


def test_label_strips_partial_slug_prefix():
    # Catalog slug "outlook-mail", but the toolkit prefixes tools as OUTLOOK_
    assert _trace_action_label("OUTLOOK_LIST_MESSAGES", "outlook-mail") == "List Messages"


def test_label_keeps_name_when_prefix_does_not_match():
    assert _trace_action_label("WEIRD_TOOL", "stripe") == "Weird Tool"


def test_label_keeps_whole_name_when_stripping_would_empty_it():
    assert _trace_action_label("STRIPE", "stripe") == "Stripe"


def test_label_handles_native_tools_with_no_integration():
    assert _trace_action_label("draft_content", None) == "Draft Content"


# ── Detail: "what came back", counted out of assorted provider shapes ───────

def test_detail_unwraps_composio_data_envelope():
    assert _trace_detail({"data": {"messages": [1, 2, 3]}}) == "3 results"


def test_detail_counts_bare_list():
    assert _trace_detail([1, 2]) == "2 results"


def test_detail_parses_json_string_results():
    assert _trace_detail(json.dumps({"data": {"results": [0] * 14}})) == "14 results"


def test_detail_singularizes_one_result():
    assert _trace_detail({"items": [1]}) == "1 result"


def test_detail_returns_none_when_nothing_countable():
    assert _trace_detail({"ok": True}) is None
    assert _trace_detail("not json") is None


# ── Trace assembly ─────────────────────────────────────────────────────────

ALIAS_MAP = {
    "mcp_gmail_GMAIL_FETCH_EMAILS": ("ca_1", "GMAIL_FETCH_EMAILS"),
    "mcp_slack_SLACK_SEND_MESSAGE": ("ca_2", "SLACK_SEND_MESSAGE"),
    "mcp_gmail_GMAIL_BROKEN": ("ca_1", "GMAIL_BROKEN"),
}
INTEGRATION_BY_CONNECTION = {"ca_1": "gmail", "ca_2": "slack"}


def _call(name, result=None, is_error=False, duration_ms=None):
    return {"name": name, "result": result, "is_error": is_error, "duration_ms": duration_ms}


def test_trace_reports_executed_read_with_count_and_timing():
    trace = _build_tool_trace(
        [_call("mcp_gmail_GMAIL_FETCH_EMAILS", {"data": {"messages": [0] * 14}}, duration_ms=812)],
        ALIAS_MAP,
        INTEGRATION_BY_CONNECTION,
        set(),
    )
    assert trace == [{
        "label": "Fetch Emails",
        "integration": "gmail",
        "status": "ok",
        "detail": "14 results",
        "durationMs": 812,
    }]


def test_trace_marks_staged_writes_pending_not_done():
    """Write tools are staged for confirmation, never executed on the turn —
    the trace must not claim they happened."""
    trace = _build_tool_trace(
        [_call("mcp_slack_SLACK_SEND_MESSAGE", duration_ms=5)],
        ALIAS_MAP,
        INTEGRATION_BY_CONNECTION,
        {"mcp_slack_SLACK_SEND_MESSAGE"},
    )
    assert trace[0]["status"] == "pending"
    assert "detail" not in trace[0]


def test_trace_marks_failures_and_omits_their_detail():
    trace = _build_tool_trace(
        [_call("mcp_gmail_GMAIL_BROKEN", "Error: boom", is_error=True, duration_ms=120)],
        ALIAS_MAP,
        INTEGRATION_BY_CONNECTION,
        set(),
    )
    assert trace[0]["status"] == "error"
    assert "detail" not in trace[0]


def test_trace_labels_native_tools_with_no_integration():
    trace = _build_tool_trace([_call("draft_content", {"ok": 1})], {}, {}, set())
    assert trace[0]["integration"] is None
    assert trace[0]["label"] == "Draft Content"


def test_trace_preserves_call_order():
    trace = _build_tool_trace(
        [
            _call("mcp_gmail_GMAIL_FETCH_EMAILS", {"data": {"messages": []}}),
            _call("draft_content", {"ok": 1}),
            _call("mcp_slack_SLACK_SEND_MESSAGE"),
        ],
        ALIAS_MAP,
        INTEGRATION_BY_CONNECTION,
        {"mcp_slack_SLACK_SEND_MESSAGE"},
    )
    assert [entry["label"] for entry in trace] == ["Fetch Emails", "Draft Content", "Send Message"]


def test_trace_is_empty_when_no_tools_ran():
    assert _build_tool_trace([], ALIAS_MAP, INTEGRATION_BY_CONNECTION, set()) == []


def test_trace_omits_duration_when_not_recorded():
    trace = _build_tool_trace([_call("draft_content", {"ok": 1})], {}, {}, set())
    assert "durationMs" not in trace[0]
