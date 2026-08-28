"""Executing one node of a run's DAG.

Deliberately not `chat_sync`. Reusing that per node would redo RAG retrieval,
brand-kit assembly and memory injection for every step — ten nodes meaning ten
of each for a single user request. It also stages writes and stops, which is
precisely the behaviour a planned run has to change: an approved write must
execute and hand its real result back to the model, or nothing can chain past
it.

What it does share is `BaseAgent._assemble_tools`, so a step sees exactly the
tool surface an ordinary turn would, narrowed to its own integration.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

from core.models import ChatRequest
from core.tools import ToolResult, format_tool_result_messages
from core.runs.store import RunStore, WriteRequest

logger = logging.getLogger("run_step")

# A planned step is narrower than a free-form turn, so it needs fewer rounds,
# not more. Raising this would quietly reintroduce the multi-step burden the
# planner exists to lift out of the inner loop.
STEP_MAX_ITERATIONS = 6
# Lower than chat_sync's 300s: inside a background run a stuck tool can be
# retried and replanned around, so failing fast beats waiting.
STEP_TOOL_TIMEOUT = 120.0
# Upstream text is truncated hard — three unbounded predecessors would exhaust
# any context window on their own (a single tool result can reach 100k chars).
UPSTREAM_CHARS_PER_STEP = 12_000
UPSTREAM_CHARS_TOTAL = 40_000
MAX_TOOL_RESULT_CHARS = 100_000
# Guards the gap between approving an intent and its arguments existing: the
# user approved "open a fix-list", not "open ninety issues".
MAX_WRITES_PER_STEP = 10


@dataclass
class UpstreamContext:
    key: str
    title: str
    text: str


@dataclass
class StepOutcome:
    text: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    tool_trace: list[dict] = field(default_factory=list)
    rich_results: list[tuple[str, dict]] = field(default_factory=list)
    pending_actions: list[dict] = field(default_factory=list)
    tool_calls_used: int = 0
    error: str | None = None
    #: Set when a write fell outside the approved plan; the run must pause.
    needs_approval: str | None = None


def build_upstream_block(upstream: list[UpstreamContext]) -> str:
    """Results of earlier steps, as a structured, budgeted block."""
    if not upstream:
        return ""
    parts, total = [], 0
    for u in upstream:
        text = (u.text or "").strip()
        if not text:
            continue
        if len(text) > UPSTREAM_CHARS_PER_STEP:
            text = text[:UPSTREAM_CHARS_PER_STEP] + "\n…[truncated]"
        if total + len(text) > UPSTREAM_CHARS_TOTAL:
            parts.append(f"### {u.key} — {u.title}\n[omitted: context budget reached]")
            break
        total += len(text)
        parts.append(f"### {u.key} — {u.title}\n{text}")
    if not parts:
        return ""
    return "\n\n## Results from earlier steps in this plan\n\n" + "\n\n".join(parts)


async def run_step(
    agent,
    *,
    request: ChatRequest,
    run_id: str,
    step_key: str,
    intent: str,
    system_prompt: str,
    store: RunStore,
    upstream: list[UpstreamContext] | None = None,
    integration_slug: str | None = None,
    write_mode: Literal["stage", "execute"] = "stage",
    is_write: bool = False,
    tool_budget: int = 20,
    max_iterations: int = STEP_MAX_ITERATIONS,
) -> StepOutcome:
    """Run one node to completion and report what it did."""
    upstream = upstream or []
    outcome = StepOutcome()

    bundle = await agent._assemble_tools(
        request,
        # The planner already chose this agent; letting a step delegate would
        # reintroduce the uncontrolled nesting the plan exists to replace, and
        # make the graph a lie about what actually ran.
        include_ask_agent=False,
        restrict_to_integration=integration_slug,
    )
    if not bundle.tools:
        outcome.error = "no tools available for this step"
        return outcome

    system = system_prompt + build_upstream_block(upstream)
    messages: list[dict] = [{"role": "user", "content": intent}]
    all_calls: list[dict] = []
    writes_done = 0

    for _iteration in range(max_iterations):
        if outcome.tool_calls_used >= tool_budget:
            outcome.error = "step exhausted its tool budget"
            break

        response = await agent.llm.complete_with_tools(
            provider=agent.default_provider,
            model=agent.default_model,
            system=system,
            messages=messages,
            tools=bundle.tools,
        )

        if response.finish_reason == "stop":
            outcome.text = response.content or ""
            break

        valid = [
            tc for tc in response.tool_calls
            if agent.validate_tool_call(tc.name, tc.arguments, bundle.tools) is None
        ]
        if not valid:
            outcome.text = response.content or ""
            break

        stub_start = len(all_calls)
        for tc in valid:
            all_calls.append({
                "id": tc.id, "name": tc.name, "arguments": tc.arguments,
                "result": None, "is_error": False,
            })

        async def _run_one(tc) -> str:
            nonlocal writes_done
            if tc.name in bundle.mcp_alias_map:
                connection_id, real_name = bundle.mcp_alias_map[tc.name]
                if tc.name in bundle.mcp_write_set:
                    summary = _humanize(real_name, tc.arguments)
                    if write_mode == "stage":
                        pending_id = str(uuid.uuid4())
                        outcome.pending_actions.append({
                            "id": pending_id, "connection_id": connection_id,
                            "tool_name": real_name, "arguments": tc.arguments,
                            "summary": summary,
                        })
                        return json.dumps({
                            "status": "pending_confirmation",
                            "message": "Staged for the user to approve. Do not retry it.",
                        })
                    if writes_done >= MAX_WRITES_PER_STEP:
                        outcome.needs_approval = (
                            f"this step tried more than {MAX_WRITES_PER_STEP} writes"
                        )
                        return json.dumps({
                            "status": "paused",
                            "message": "Write limit reached; waiting on the user.",
                        })
                    writes_done += 1
                    res = await store.execute_write(
                        run_id, step_key,
                        WriteRequest(connection_id, real_name, tc.arguments, summary),
                    )
                    if res.requires_approval:
                        outcome.needs_approval = summary
                        return json.dumps({
                            "status": "needs_approval",
                            "message": "Not covered by the approved plan; paused.",
                        })
                    if not res.executed:
                        raise RuntimeError(res.error or "write failed")
                    # The real provider result goes back to the model — this is
                    # what lets a later step build on what a write produced.
                    return json.dumps(res.result)
                return await agent._execute_mcp_tool(
                    tc.name, tc.arguments, request.organization_id, bundle.mcp_alias_map
                )
            return await agent.execute_tool(
                tc.name, tc.arguments, request.user_id, request.organization_id
            )

        async def _timed(index: int, tc):
            started = time.monotonic()
            try:
                return await asyncio.wait_for(_run_one(tc), timeout=STEP_TOOL_TIMEOUT)
            finally:
                all_calls[index]["duration_ms"] = int((time.monotonic() - started) * 1000)

        raw_results = await asyncio.gather(
            *[_timed(stub_start + i, tc) for i, tc in enumerate(valid)],
            return_exceptions=True,
        )
        outcome.tool_calls_used += len(valid)

        tool_results = []
        for i, raw in enumerate(raw_results):
            idx = stub_start + i
            if isinstance(raw, BaseException):
                all_calls[idx]["is_error"] = True
                all_calls[idx]["result"] = f"Error: {raw}"
                tool_results.append(ToolResult(
                    tool_call_id=valid[i].id, name=valid[i].name,
                    content=f"Error executing tool: {raw}", is_error=True,
                ))
                continue
            text = raw if isinstance(raw, str) else json.dumps(raw)
            try:
                all_calls[idx]["result"] = json.loads(text)
            except Exception:
                all_calls[idx]["result"] = text
            if len(text) > MAX_TOOL_RESULT_CHARS:
                text = text[:MAX_TOOL_RESULT_CHARS] + "\n…[truncated]"
            tool_results.append(ToolResult(
                tool_call_id=valid[i].id, name=valid[i].name, content=text,
            ))

        messages.extend(
            format_tool_result_messages(agent.default_provider, valid, tool_results)
        )

        if outcome.needs_approval:
            break
    else:
        # Ran out of iterations without a final answer. Say so rather than
        # letting the caller present a partial result as complete.
        outcome.error = outcome.error or "step did not finish within its iteration budget"

    # A step the plan marked as a write, that performed none, did not do its
    # job — most often it answered with a clarifying question instead of
    # acting. Reporting that as success is the worst outcome available: the
    # graph shows green, dependents run against nothing, and the final summary
    # hands over an artifact that was never created.
    performed = writes_done + len(outcome.pending_actions)
    if is_write and not performed and not outcome.needs_approval and not outcome.error:
        outcome.error = (
            "this step was supposed to create or change something, but it made "
            "no write. Do not ask the user a question here - use the data from "
            "the earlier steps and perform the write, or state plainly that it "
            "cannot be done."
        )

    outcome.tool_calls = all_calls
    from agents.base import _build_tool_trace, _pick_rich_result

    outcome.tool_trace = _build_tool_trace(
        all_calls, bundle.mcp_alias_map, bundle.integration_by_connection, bundle.mcp_write_set
    )
    action_id, action_result = _pick_rich_result(all_calls)
    if action_id and action_result:
        outcome.rich_results.append((action_id, action_result))
    return outcome


def _humanize(tool_name: str, arguments: dict) -> str:
    from agents.base import _humanize_mcp_call

    return _humanize_mcp_call(tool_name, arguments)
