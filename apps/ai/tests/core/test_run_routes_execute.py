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
    assert "did NOT" in llm.system
    assert "describe such a step as done" in llm.system


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


# ── Deliverables ────────────────────────────────────────────────────────────

def _wstep(key, **kw):
    return StepSpec(
        key=key, agent="sage", title=f"Step {key}", intent=f"do {key}",
        integration_slug=None, depends_on=(), is_write=True, **kw,
    )


def test_links_from_write_steps_come_first():
    """The artifact a run created is the deliverable; a link it merely read
    about is not."""
    spec = _spec([_step("s1"), _wstep("s2")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="see https://example.com/ref"),
        "s2": _StepState(status="SUCCEEDED", output_text="made https://docs.google.com/x/edit"),
    })

    assert routes._deliverables(spec, result)[0] == "https://docs.google.com/x/edit"


def test_trailing_punctuation_is_not_part_of_the_link():
    spec = _spec([_wstep("s1")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="here: (https://a.com/b/edit)."),
    })

    assert routes._deliverables(spec, result) == ["https://a.com/b/edit"]


def test_links_from_failed_steps_are_ignored():
    """A step that failed did not produce anything to hand over."""
    spec = _spec([_wstep("s1")])
    result = RunResult("FAILED", "", {
        "s1": _StepState(status="FAILED", output_text="https://a.com/x", error="boom"),
    })

    assert routes._deliverables(spec, result) == []


@pytest.mark.asyncio
async def test_a_run_that_produced_a_file_is_told_not_to_restate_it(monkeypatch):
    """The regression this fixes: a run that built a spreadsheet answered by
    reprinting the spreadsheet, burying the link on the last line."""
    llm = _RecordingLLM()
    monkeypatch.setattr(routes, "_llm", llm)
    spec = _spec([_wstep("s1")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="Sheet: https://docs.google.com/x/edit"),
    })

    await routes._summarize(spec, result)

    assert "Do NOT reproduce the contents" in llm.system
    assert "three short sentences" in llm.system
    # The link is handed over as data, not left for the model to find.
    assert "https://docs.google.com/x/edit" in llm.content


@pytest.mark.asyncio
async def test_a_run_with_no_artifact_still_carries_the_findings(monkeypatch):
    """When nothing was created, the message IS the deliverable — telling it to
    hand over a link it does not have would lose the answer entirely."""
    llm = _RecordingLLM()
    monkeypatch.setattr(routes, "_llm", llm)
    spec = _spec([_step("s1")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="24 clicks last week"),
    })

    await routes._summarize(spec, result)

    assert "Do NOT reproduce the contents" not in llm.system
    assert "Lead with what they asked" in llm.system


@pytest.mark.asyncio
async def test_read_only_run_mentioning_a_link_is_not_treated_as_a_handover(monkeypatch):
    """A run that only read things may quote a URL; that is not a deliverable."""
    llm = _RecordingLLM()
    monkeypatch.setattr(routes, "_llm", llm)
    spec = _spec([_step("s1")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="top page https://veqiro.com/"),
    })

    await routes._summarize(spec, result)

    assert "Do NOT reproduce the contents" not in llm.system


@pytest.mark.asyncio
async def test_fallback_leads_with_the_link(monkeypatch):
    class _Broken:
        async def complete(self, **kw):
            raise RuntimeError("model down")

    monkeypatch.setattr(routes, "_llm", _Broken())
    spec = _spec([_wstep("s1")])
    result = RunResult("COMPLETED", "", {
        "s1": _StepState(status="SUCCEEDED", output_text="done https://docs.google.com/x/edit"),
    })

    summary = await routes._summarize(spec, result)

    assert summary.startswith("https://docs.google.com/x/edit")
