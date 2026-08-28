"""Covers the execute endpoint and the final-summary builder.

The summary is the entire answer the user reads, so the thing worth pinning
down is that a partial run cannot be described as a finished one.
"""

import pytest

from core.runs import routes
from core.runs.executor import RunResult, RunSpec, StepSpec, _StepState


def _spec(steps, goal="do the thing"):
    return RunSpec(
        run_id="run-1", organization_id="org", user_id="user",
        goal=goal, steps=steps,
    )


def _step(key, **kw):
    return StepSpec(
        key=key, agent="sage", title=f"Step {key}", intent=f"do {key}",
        integration_slug=None, depends_on=(), is_write=False, **kw,
    )


def _body(**kw):
    base = dict(
        run_id="11111111-1111-1111-1111-111111111111",
        organization_id="org", user_id="user", goal="g",
        steps=[{"key": "s1", "agent": "sage", "title": "T", "intent": "i"}],
    )
    base.update(kw)
    return routes.ExecuteRequest(**base)


# ── Dispatch guards ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_refuses_a_run_already_in_flight(monkeypatch):
    """The sweeper re-dispatches a quiet run; if the original task is merely
    slow rather than dead, accepting again would run every step twice."""
    body = _body()
    monkeypatch.setattr(routes, "_inflight", {body.run_id})

    result = await routes.execute_run(body)

    assert result.accepted is False


@pytest.mark.asyncio
async def test_execute_refuses_a_run_with_nothing_left(monkeypatch):
    monkeypatch.setattr(routes, "_inflight", set())
    body = _body(steps=[{
        "key": "s1", "agent": "sage", "title": "T", "intent": "i",
        "prior_status": "SUCCEEDED",
    }])

    result = await routes.execute_run(body)

    assert result.accepted is False
    assert "nothing left" in result.reason


@pytest.mark.asyncio
async def test_execute_refuses_when_every_step_is_disabled(monkeypatch):
    monkeypatch.setattr(routes, "_inflight", set())
    body = _body(steps=[{
        "key": "s1", "agent": "sage", "title": "T", "intent": "i", "enabled": False,
    }])

    assert (await routes.execute_run(body)).accepted is False


# ── Summary honesty ─────────────────────────────────────────────────────────

class _RecordingLLM:
    def __init__(self):
        self.system = ""
        self.content = ""

    async def complete(self, *, provider, model, system, messages, **kw):
        self.system = system
        self.content = messages[0]["content"]
        return "final answer"


@pytest.mark.asyncio
async def test_summary_reports_failed_steps_to_the_model(monkeypatch):
    llm = _RecordingLLM()
    monkeypatch.setattr(routes, "_llm", llm)
    spec = _spec([_step("a"), _step("b")])
    result = RunResult(status="PARTIAL", summary="", steps={
        "a": _StepState(status="SUCCEEDED", output_text="found 12 pages"),
        "b": _StepState(status="FAILED", error="Linear rejected the write"),
    })

    await routes._summarize(spec, result)

    # The failure must reach the model, and the model must be told what a
    # failed step means — otherwise a PARTIAL run reads as a completed one.
    assert "FAILED" in llm.content
    assert "Linear rejected the write" in llm.content
    assert "did" in llm.system and "NOT happen" in llm.system


@pytest.mark.asyncio
async def test_summary_falls_back_to_raw_results_when_the_model_fails(monkeypatch):
    class _Broken:
        async def complete(self, **kw):
            raise RuntimeError("model down")

    monkeypatch.setattr(routes, "_llm", _Broken())
    spec = _spec([_step("a")])
    result = RunResult(status="COMPLETED", summary="", steps={
        "a": _StepState(status="SUCCEEDED", output_text="found 12 pages"),
    })

    summary = await routes._summarize(spec, result)

    # Losing every result to one failed LLM call would be the worse outcome.
    assert "found 12 pages" in summary


@pytest.mark.asyncio
async def test_summary_is_empty_when_nothing_ran(monkeypatch):
    monkeypatch.setattr(routes, "_llm", _RecordingLLM())
    assert await routes._summarize(_spec([]), RunResult("FAILED", "", {})) == ""
