"""A write step that performed no write must not report success.

The regression: a plan said "create a spreadsheet", the step answered with a
clarifying question instead of calling a tool, and was recorded SUCCEEDED.
The graph showed green, its dependents ran against nothing, and the final
summary handed over an artifact that had never been created.
"""

import pytest

from core.models import ChatRequest
from core.runs.step import run_step
from core.runs.store import InMemoryRunStore


class _Bundle:
    def __init__(self, write_alias=None):
        self.tools = [object()]
        self.mcp_alias_map = {write_alias: ("conn-1", "SHEETS_CREATE")} if write_alias else {}
        self.mcp_write_set = {write_alias} if write_alias else set()
        self.integration_by_connection = {"conn-1": "google-sheets"}
        self.mcp_connections = [{"connectionId": "conn-1", "integrationSlug": "google-sheets"}]
        self.superseded_names: list[str] = []
        self.replacement_mcp_names: list[str] = []


class _Resp:
    def __init__(self, content="", tool_calls=(), finish_reason="stop"):
        self.content = content
        self.tool_calls = list(tool_calls)
        self.finish_reason = finish_reason


class _Call:
    def __init__(self, name, arguments=None):
        self.id = "tc-1"
        self.name = name
        self.arguments = arguments or {}


class _Agent:
    """Minimal stand-in: only what run_step actually touches."""

    def __init__(self, responses, bundle):
        self._responses = list(responses)
        self._bundle = bundle
        self.default_provider = "openai"
        self.default_model = "m"
        self.llm = self

    async def complete_with_tools(self, **kw):
        return self._responses.pop(0)

    async def _assemble_tools(self, request, **kw):
        return self._bundle

    def validate_tool_call(self, name, args, tools):
        return None

    async def _execute_mcp_tool(self, *a, **kw):
        return "{}"

    async def execute_tool(self, *a, **kw):
        return "{}"


def _request():
    return ChatRequest(
        user_id="u", organization_id="o", conversation_id="c",
        message="m", history=[], metadata={},
    )


async def _run(agent, *, is_write, write_mode="execute"):
    return await run_step(
        agent,
        request=_request(),
        run_id="run-1",
        step_key="s1",
        intent="Create a spreadsheet of the qualifying queries",
        system_prompt="sys",
        store=InMemoryRunStore(),
        is_write=is_write,
        write_mode=write_mode,
    )


@pytest.mark.asyncio
async def test_write_step_that_only_asks_a_question_fails():
    agent = _Agent(
        [_Resp(content="I can create the spreadsheet, but what columns do you want?")],
        _Bundle(write_alias="mcp_google_sheets_create"),
    )

    outcome = await _run(agent, is_write=True)

    assert outcome.error, "a write step that wrote nothing is not a success"
    assert "no write" in outcome.error


@pytest.mark.asyncio
async def test_write_step_that_actually_writes_succeeds():
    alias = "mcp_google_sheets_create"
    agent = _Agent(
        [
            _Resp(tool_calls=[_Call(alias)], finish_reason="tool_calls"),
            _Resp(content="Created the sheet."),
        ],
        _Bundle(write_alias=alias),
    )

    outcome = await _run(agent, is_write=True)

    assert outcome.error is None
    assert outcome.text == "Created the sheet."


@pytest.mark.asyncio
async def test_staged_write_counts_as_performed():
    """In stage mode nothing is executed, but the action was still produced —
    an unattended run that stages a card has done its job."""
    alias = "mcp_google_sheets_create"
    agent = _Agent(
        [
            _Resp(tool_calls=[_Call(alias)], finish_reason="tool_calls"),
            _Resp(content="Staged for approval."),
        ],
        _Bundle(write_alias=alias),
    )

    outcome = await _run(agent, is_write=True, write_mode="stage")

    assert outcome.error is None
    assert outcome.pending_actions


@pytest.mark.asyncio
async def test_read_step_answering_in_prose_is_untouched():
    """The rule must not touch read steps, whose whole output is prose."""
    agent = _Agent([_Resp(content="Here are the top queries.")], _Bundle())

    outcome = await _run(agent, is_write=False)

    assert outcome.error is None
    assert outcome.text == "Here are the top queries."
