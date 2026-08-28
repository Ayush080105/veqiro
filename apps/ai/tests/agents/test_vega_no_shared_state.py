"""Guards the singleton-safety rule for VegaAgent.

Agents are constructed once at import time in agents/*/routes.py and shared by
every org's concurrent requests (see agents/registry.py). VegaAgent used to
assign per-request values onto `self` in its chat_sync override —
`_google_token`, `_label_definitions`, `_node_actions_buffer` — so two
overlapping turns could read each other's values.

All three were in fact write-only or dead (the live, parameterised label
helpers live at module scope in agents/vega/routes.py), so they were removed
rather than threaded through. These tests keep them from coming back.
"""

import asyncio

import pytest

from agents.vega.agent import VegaAgent
from core.models import ChatRequest, ChatSyncResponse


def _agent() -> VegaAgent:
    # Fresh instance, never the registry singleton.
    return VegaAgent(object(), object())


# Set once at construction and never reassigned per request, so they are safe
# to share across orgs. Anything else on the instance is a leak.
CONSTRUCTION_DEPS = {"llm", "rag"}


def test_vega_holds_no_per_request_instance_state():
    leaked = set(vars(_agent())) - CONSTRUCTION_DEPS
    assert leaked == set(), (
        f"VegaAgent must stay stateless — it is a process-wide singleton; leaked: {leaked}"
    )


def test_vega_defines_no_per_request_attributes():
    for banned in ("_google_token", "_label_definitions", "_node_actions_buffer"):
        assert not hasattr(_agent(), banned), f"{banned} is back on the singleton"


@pytest.mark.asyncio
async def test_concurrent_turns_do_not_cross(monkeypatch):
    """Two overlapping turns with different Google tokens must not interfere.

    The inner chat_sync is stubbed to interleave deliberately: A starts, yields,
    B runs to completion, then A resumes. Under the old code A's second half ran
    after B had overwritten the shared attributes.
    """
    agent = _agent()
    seen: list[str] = []

    async def fake_super(request: ChatRequest) -> ChatSyncResponse:
        token = request.metadata.get("google_access_token", "")
        seen.append(f"start:{token}")
        await asyncio.sleep(0)          # force a suspension point
        # Whatever the agent reports must derive from THIS request only.
        seen.append(f"end:{token}")
        return ChatSyncResponse(
            response=token, agent="vega", message_id="m", tokens_used=0,
            model_used="test", metadata={}, tool_trace=[],
        )

    monkeypatch.setattr(
        "agents.base.BaseAgent.chat_sync",
        lambda self, request: fake_super(request),
    )

    def req(token: str) -> ChatRequest:
        return ChatRequest(
            user_id="u", organization_id=f"org-{token}", conversation_id="c",
            message="hi", history=[], metadata={"google_access_token": token},
        )

    a, b = await asyncio.gather(
        agent.chat_sync(req("token-A")), agent.chat_sync(req("token-B"))
    )

    assert a.response == "token-A"
    assert b.response == "token-B"
    leaked = set(vars(agent)) - CONSTRUCTION_DEPS
    assert leaked == set(), f"a turn leaked state onto the shared instance: {leaked}"


@pytest.mark.asyncio
async def test_node_action_is_stripped_from_a_delegated_card(monkeypatch):
    """Reachable now that a delegate's card can surface on Vega's response
    (see BaseAgent.CrossAgentSink)."""
    agent = _agent()

    async def fake_super(request):
        return ChatSyncResponse(
            response="ok", agent="vega", message_id="m", tokens_used=0,
            model_used="test", metadata={}, tool_trace=[],
            action_id="maya:draft-content",
            action_result={"body": "hello", "node_action": {"secret": 1}},
        )

    monkeypatch.setattr(
        "agents.base.BaseAgent.chat_sync",
        lambda self, request: fake_super(request),
    )

    out = await agent.chat_sync(
        ChatRequest(user_id="u", organization_id="o", conversation_id="c",
                    message="hi", history=[], metadata={})
    )
    assert out.action_result == {"body": "hello"}
