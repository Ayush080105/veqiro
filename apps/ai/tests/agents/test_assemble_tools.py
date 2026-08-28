"""Covers BaseAgent._assemble_tools (agents/base.py).

This is the seam the run executor shares with chat_sync: it builds a turn's
tool surface (native + ask_agent + connected MCP) without chat_sync's
per-request RAG and brand-kit work, which must not run per step.

Extracted as a pure refactor, so these tests describe behaviour that already
existed inline — they exist to keep it stable now that a second caller depends
on it.
"""

import pytest

from agents.base import BaseAgent
from core.models import ChatRequest
from core.tools import ToolDefinition, ToolParameter


class _Agent(BaseAgent):
    slug = "sage"
    name = "Sage"

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="audit_page",
                description="Audit a page",
                parameters=[ToolParameter(name="url", type="string", description="url")],
            )
        ]


def _agent() -> _Agent:
    return _Agent(object(), object())


def _request(**metadata) -> ChatRequest:
    return ChatRequest(
        user_id="u", organization_id="org", conversation_id="c",
        message="hi", history=[], metadata=metadata,
    )


@pytest.fixture
def fake_mcp(monkeypatch):
    """Two tools per connection: one read, one write."""
    seen: dict = {}

    async def fake_get_mcp_tools(org, agent_slug, connections, reserved_tools=0):
        seen["connections"] = [c.get("integrationSlug") for c in connections]
        seen["reserved_tools"] = reserved_tools
        defs, alias_map = [], {}
        for c in connections:
            slug = c["integrationSlug"]
            for verb, is_write in (("GET_THING", False), ("SEND_THING", True)):
                alias = f"mcp_{slug}_{verb}"
                defs.append(ToolDefinition(
                    name=alias, description=verb, raw_schema={"type": "object"},
                    is_write=is_write,
                ))
                alias_map[alias] = (c["connectionId"], verb)
        return defs, alias_map

    monkeypatch.setattr("agents.base.get_mcp_tools", fake_get_mcp_tools)
    return seen


def _conns(*slugs):
    return [{"connectionId": f"conn-{s}", "integrationSlug": s} for s in slugs]


@pytest.mark.asyncio
async def test_includes_native_and_ask_agent():
    bundle = await _agent()._assemble_tools(_request(), include_ask_agent=True)
    names = [t.name for t in bundle.tools]
    assert "audit_page" in names
    assert "ask_agent" in names


@pytest.mark.asyncio
async def test_ask_agent_can_be_excluded():
    """The executor turns this off: the planner already assigned the agent,
    so a step delegating further would make the task graph a lie."""
    bundle = await _agent()._assemble_tools(_request(), include_ask_agent=False)
    assert "ask_agent" not in [t.name for t in bundle.tools]


@pytest.mark.asyncio
async def test_ask_agent_cannot_target_the_calling_agent():
    bundle = await _agent()._assemble_tools(_request(), include_ask_agent=True)
    ask = next(t for t in bundle.tools if t.name == "ask_agent")
    enum = next(p.enum for p in ask.parameters if p.name == "agent_slug")
    assert "sage" not in enum


@pytest.mark.asyncio
async def test_merges_mcp_tools_and_classifies_writes(fake_mcp):
    bundle = await _agent()._assemble_tools(
        _request(mcp_connections=_conns("gmail", "linear")), include_ask_agent=True
    )
    names = [t.name for t in bundle.tools]
    assert "mcp_gmail_GET_THING" in names
    assert "mcp_linear_SEND_THING" in names
    # Only writes are staged for approval.
    assert bundle.mcp_write_set == {"mcp_gmail_SEND_THING", "mcp_linear_SEND_THING"}
    assert bundle.mcp_alias_map["mcp_gmail_GET_THING"] == ("conn-gmail", "GET_THING")


@pytest.mark.asyncio
async def test_integration_map_covers_every_connection(fake_mcp):
    bundle = await _agent()._assemble_tools(
        _request(mcp_connections=_conns("gmail", "linear")), include_ask_agent=True
    )
    assert bundle.integration_by_connection == {
        "conn-gmail": "gmail", "conn-linear": "linear"
    }


@pytest.mark.asyncio
async def test_restrict_narrows_to_one_integration(fake_mcp):
    """Per-step narrowing — the dominant failure mode with a large tool list is
    the model reaching for a neighbouring integration's tool."""
    bundle = await _agent()._assemble_tools(
        _request(mcp_connections=_conns("gmail", "linear")),
        include_ask_agent=False,
        restrict_to_integration="linear",
    )
    assert fake_mcp["connections"] == ["linear"]
    assert not any(n.startswith("mcp_gmail_") for n in bundle.mcp_alias_map)


@pytest.mark.asyncio
async def test_reserved_tools_reflects_the_non_mcp_count(fake_mcp):
    """Feeds the truncation budget, and now the cache key too."""
    await _agent()._assemble_tools(
        _request(mcp_connections=_conns("gmail")), include_ask_agent=True
    )
    assert fake_mcp["reserved_tools"] == 2  # audit_page + ask_agent


@pytest.mark.asyncio
async def test_no_connections_leaves_mcp_state_empty():
    bundle = await _agent()._assemble_tools(_request(), include_ask_agent=True)
    assert bundle.mcp_alias_map == {}
    assert bundle.mcp_write_set == set()
    assert bundle.mcp_connections == []
