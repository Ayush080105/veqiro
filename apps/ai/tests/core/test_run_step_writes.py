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

    # Caught by the stalled-question rule, which is the more specific
    # diagnosis; either way it must not be reported as a success.
    assert outcome.error, "a write step that wrote nothing is not a success"
    assert "asking a question" in outcome.error


@pytest.mark.asyncio
async def test_write_step_that_narrates_without_writing_fails():
    """No question mark, still no write — this is the one the write-check
    exists for."""
    agent = _Agent(
        [_Resp(content="The spreadsheet has been prepared with all the columns.")],
        _Bundle(write_alias="mcp_google_sheets_create"),
    )

    outcome = await _run(agent, is_write=True)

    assert outcome.error
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


# ── Stalled steps ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_step_that_ends_on_a_question_fails():
    """The live failure: "create promotional image" answered "Which platform —
    LinkedIn, Instagram, or Twitter/X?", called nothing, and showed green. No
    image was ever made, and the email step downstream had nothing to send."""
    agent = _Agent(
        [_Resp(content="Which platform — LinkedIn, Instagram, or Twitter/X?")],
        _Bundle(),
    )

    outcome = await _run(agent, is_write=False)

    assert outcome.error
    assert "asking a question" in outcome.error


@pytest.mark.asyncio
async def test_a_step_that_used_tools_may_still_end_on_a_question():
    """Only a step that did nothing at all counts as stalled — one that worked
    and closed with a rhetorical question has still delivered."""
    alias = "mcp_google_sheets_create"
    agent = _Agent(
        [
            _Resp(tool_calls=[_Call(alias)], finish_reason="tool_calls"),
            _Resp(content="Done. Want me to schedule it too?"),
        ],
        _Bundle(write_alias=alias),
    )

    outcome = await _run(agent, is_write=True)

    assert outcome.error is None


@pytest.mark.asyncio
async def test_prose_answer_without_tools_is_still_fine():
    """A synthesis step legitimately calls nothing — it must not be caught."""
    agent = _Agent([_Resp(content="Here is the combined summary.")], _Bundle())

    outcome = await _run(agent, is_write=False)

    assert outcome.error is None


@pytest.mark.asyncio
async def test_the_step_is_told_nobody_can_answer_it():
    """Prevention, not just detection — the model should not ask in the first
    place."""
    captured = {}

    class _Capturing(_Agent):
        async def complete_with_tools(self, **kw):
            captured["system"] = kw["system"]
            return _Resp(content="Picked Instagram and made the asset.")

    await _run(_Capturing([], _Bundle()), is_write=False)

    assert "UNATTENDED" in captured["system"]
    assert "Nobody will read a question" in captured["system"]


# ── Review gate ─────────────────────────────────────────────────────────────

class _MayaAgent(_Agent):
    slug = "maya"


@pytest.mark.asyncio
async def test_a_maya_tool_pauses_for_review_instead_of_running():
    """Her tools spend image credits and produce work whose taste matters, so
    approving the plan is not approval of the arguments a model picked."""
    agent = _MayaAgent(
        [_Resp(tool_calls=[_Call("draft_content", {"topic": "launch"})],
               finish_reason="tool_calls")],
        _Bundle(),
    )

    outcome = await _run(agent, is_write=False)

    assert outcome.needs_approval
    assert outcome.review_request == {
        "action_id": "maya:draft-content",
        "tool_name": "draft_content",
        "arguments": {"topic": "launch"},
    }


@pytest.mark.asyncio
async def test_a_non_maya_tool_with_the_same_name_is_not_gated():
    """The gate is Maya's, not the tool name's — another agent must not
    inherit it."""
    agent = _Agent(  # slug is not "maya"
        [
            _Resp(tool_calls=[_Call("draft_content")], finish_reason="tool_calls"),
            _Resp(content="done"),
        ],
        _Bundle(),
    )

    outcome = await _run(agent, is_write=False)

    assert outcome.review_request is None
    assert outcome.needs_approval is None


@pytest.mark.asyncio
async def test_an_ungated_maya_tool_still_runs():
    """modify_image has no dialog of its own, so pausing on it would show a
    form that cannot be rendered."""
    agent = _MayaAgent(
        [
            _Resp(tool_calls=[_Call("modify_image")], finish_reason="tool_calls"),
            _Resp(content="edited"),
        ],
        _Bundle(),
    )

    outcome = await _run(agent, is_write=False)

    assert outcome.review_request is None


@pytest.mark.asyncio
async def test_review_can_be_disabled_per_run():
    agent = _MayaAgent(
        [
            _Resp(tool_calls=[_Call("draft_content")], finish_reason="tool_calls"),
            _Resp(content="drafted"),
        ],
        _Bundle(),
    )

    outcome = await run_step(
        agent, request=_request(), run_id="r", step_key="s1", intent="i",
        system_prompt="sys", store=InMemoryRunStore(), review_tools={},
    )

    assert outcome.review_request is None
    assert outcome.error is None
