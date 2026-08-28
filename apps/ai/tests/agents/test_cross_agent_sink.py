"""Covers the structured half of a delegated agent's turn (base.py's
CrossAgentSink and _merge_cross_agent).

Before this, _execute_cross_agent_call returned only `result.response`, so a
delegate's staged writes never reached Node's stagePendingActions. "Maya, have
Vega email this draft" staged a pending action inside Vega that nothing ever
surfaced — the email was never sent and no confirmation card appeared.

No LLM and no network: the delegate is a stub whose chat_sync returns a
canned ChatSyncResponse.
"""

import pytest

from agents.base import BaseAgent, CrossAgentSink
from core.models import ChatSyncResponse


class _StubDelegate:
    """Minimal stand-in for a registered agent."""

    slug = "vega"

    def __init__(self, response: ChatSyncResponse):
        self._response = response
        self.seen_requests = []

    async def chat_sync(self, request):
        self.seen_requests.append(request)
        return self._response


class _Caller(BaseAgent):
    slug = "maya"
    name = "Maya"

    def get_tools(self):
        return []


def _caller() -> _Caller:
    # Fresh instance, never the registry singleton — agents are process-wide.
    return _Caller(llm_client=object(), rag_service=object())


def _delegate_response(**kw) -> ChatSyncResponse:
    base = dict(
        response="Drafted and staged.",
        agent="vega",
        message_id="m1",
        tokens_used=3,
        model_used="test",
        metadata={},
        tool_trace=[],
    )
    base.update(kw)
    return ChatSyncResponse(**base)


# ── _merge_cross_agent: pure folding ────────────────────────────────────────

def test_merge_appends_pending_and_trace():
    sink = CrossAgentSink(
        pending_actions=[{"id": "p1", "summary": "Send email"}],
        tool_trace=[{"label": "Send Email", "status": "pending", "viaAgent": "vega"}],
    )
    pending, trace, picked = BaseAgent._merge_cross_agent(
        sink, [{"id": "own"}], [{"label": "Own Call", "status": "ok"}], (None, None)
    )
    assert [p["id"] for p in pending] == ["own", "p1"]
    assert [t["label"] for t in trace] == ["Own Call", "Send Email"]
    assert picked == (None, None) or picked[0] is None


def test_merge_uses_delegate_card_only_when_caller_has_none():
    sink = CrossAgentSink(rich_results=[("vega:draft", {"a": 1})])

    _, _, picked = BaseAgent._merge_cross_agent(sink, [], [], (None, None))
    assert picked == ("vega:draft", {"a": 1})

    # The caller's own card wins.
    _, _, picked = BaseAgent._merge_cross_agent(sink, [], [], ("maya:post", {"b": 2}))
    assert picked == ("maya:post", {"b": 2})


def test_merge_is_a_noop_for_an_empty_sink():
    pending, trace, picked = BaseAgent._merge_cross_agent(
        CrossAgentSink(), [{"id": "own"}], [{"label": "L"}], ("maya:post", {"b": 2})
    )
    assert pending == [{"id": "own"}]
    assert trace == [{"label": "L"}]
    assert picked == ("maya:post", {"b": 2})


# ── _execute_cross_agent_call: propagation ──────────────────────────────────

@pytest.mark.asyncio
async def test_delegated_pending_actions_reach_the_sink(monkeypatch):
    pending = [{"id": "p1", "connection_id": "c1", "tool_name": "GMAIL_SEND_EMAIL",
                "arguments": {}, "summary": "Send email to marcus@example.com"}]
    delegate = _StubDelegate(_delegate_response(
        metadata={"pending_actions": pending},
        tool_trace=[{"label": "Send Email", "integration": "gmail", "status": "pending"}],
        action_id="vega:draft",
        action_result={"subject": "Hi"},
    ))
    monkeypatch.setattr("agents.registry.get_agent", lambda slug: delegate)

    sink = CrossAgentSink()
    out = await _caller()._execute_cross_agent_call(
        {"agent_slug": "vega", "question": "email this"},
        user_id="u1", organization_id="o1", sink=sink,
    )

    assert sink.pending_actions == pending
    assert sink.rich_results == [("vega:draft", {"subject": "Hi"})]
    # Trace entries are attributed to the delegate that ran them.
    assert [e["viaAgent"] for e in sink.tool_trace] == ["vega"]
    # The caller's LLM is told not to re-propose what was already staged.
    assert "Do not propose them again" in out
    assert "Send email to marcus@example.com" in out


@pytest.mark.asyncio
async def test_no_sink_keeps_the_plain_text_contract(monkeypatch):
    delegate = _StubDelegate(_delegate_response(
        metadata={"pending_actions": [{"id": "p1", "summary": "Send email"}]},
    ))
    monkeypatch.setattr("agents.registry.get_agent", lambda slug: delegate)

    out = await _caller()._execute_cross_agent_call(
        {"agent_slug": "vega", "question": "email this"},
        user_id="u1", organization_id="o1",
    )
    assert out == "Drafted and staged."


@pytest.mark.asyncio
async def test_self_call_is_refused_without_touching_the_sink():
    sink = CrossAgentSink()
    out = await _caller()._execute_cross_agent_call(
        {"agent_slug": "maya", "question": "loop"},
        user_id="u1", organization_id="o1", sink=sink,
    )
    assert "Cannot call yourself" in out
    assert sink.pending_actions == []
