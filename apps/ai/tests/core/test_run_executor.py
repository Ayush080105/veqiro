"""Covers DAG scheduling (core/runs/executor.py).

Runs entirely against InMemoryRunStore with a stub agent, so there is no LLM
and no network: the scheduling rules are the part worth pinning down, and they
should be testable without either.
"""

import asyncio

import pytest

from core.runs import executor as ex
from core.runs.executor import RunExecutor, RunSpec, StepSpec
from core.runs.step import StepOutcome
from core.runs.store import InMemoryRunStore


def _spec(steps, **kw):
    return RunSpec(
        run_id="run-1", organization_id="org", user_id="user",
        goal="g", steps=steps, **kw,
    )


def _step(key, deps=(), agent="sage", **kw):
    return StepSpec(
        key=key, agent=agent, title=f"Step {key}", intent=f"do {key}",
        integration_slug=None, depends_on=tuple(deps), is_write=False, **kw,
    )


@pytest.fixture
def harness(monkeypatch):
    """Replaces run_step with a scriptable stub and records execution order."""
    order: list[str] = []
    concurrent: list[int] = []
    inflight = {"n": 0}
    #: key -> outcome kwargs, or an exception-producing marker.
    script: dict[str, dict] = {}

    async def fake_run_step(agent, *, step_key, **kwargs):
        inflight["n"] += 1
        concurrent.append(inflight["n"])
        order.append(step_key)
        await asyncio.sleep(0)  # let siblings start, so overlap is observable
        inflight["n"] -= 1
        cfg = script.get(step_key, {})
        return StepOutcome(
            text=cfg.get("text", f"{step_key} done"),
            error=cfg.get("error"),
            needs_approval=cfg.get("needs_approval"),
            tool_calls_used=cfg.get("tool_calls_used", 1),
        )

    monkeypatch.setattr(ex, "run_step", fake_run_step)

    async def build_prompt(agent, org, user):
        return "system"

    store = InMemoryRunStore()
    runner = RunExecutor(store, get_agent=lambda slug: object(), build_system_prompt=build_prompt)
    return {
        "runner": runner, "store": store, "order": order,
        "concurrent": concurrent, "script": script,
    }


# ── Ordering ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dependencies_run_in_order(harness):
    result = await harness["runner"].execute(
        _spec([_step("s1"), _step("s2", ["s1"]), _step("s3", ["s2"])])
    )
    assert harness["order"] == ["s1", "s2", "s3"]
    assert result.status == "COMPLETED"


@pytest.mark.asyncio
async def test_independent_steps_share_a_wave(harness):
    await harness["runner"].execute(_spec([_step("a"), _step("b"), _step("c")]))
    # All three are runnable immediately, so they overlap.
    assert max(harness["concurrent"]) > 1


@pytest.mark.asyncio
async def test_parallelism_is_capped(harness, monkeypatch):
    monkeypatch.setattr(ex, "MAX_PARALLEL_STEPS", 2)
    await harness["runner"].execute(_spec([_step(f"s{i}") for i in range(6)]))
    assert max(harness["concurrent"]) <= 2


@pytest.mark.asyncio
async def test_diamond_join_waits_for_both_arms(harness):
    await harness["runner"].execute(
        _spec([_step("a"), _step("b", ["a"]), _step("c", ["a"]), _step("d", ["b", "c"])])
    )
    order = harness["order"]
    assert order[0] == "a"
    assert order.index("d") > max(order.index("b"), order.index("c"))


# ── Failure handling ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_step_is_retried_once_then_fails(harness):
    harness["script"]["s1"] = {"error": "boom"}
    result = await harness["runner"].execute(_spec([_step("s1"), _step("s2")]))
    assert harness["order"].count("s1") == 2, "should attempt exactly twice"
    assert result.steps["s1"].status == "FAILED"


@pytest.mark.asyncio
async def test_failure_blocks_only_its_dependents(harness):
    harness["script"]["a"] = {"error": "boom"}
    result = await harness["runner"].execute(
        _spec([_step("a"), _step("b", ["a"]), _step("c")])
    )
    assert result.steps["a"].status == "FAILED"
    assert result.steps["b"].status == "BLOCKED"
    # The independent branch is unaffected — that is the point of a DAG.
    assert result.steps["c"].status == "SUCCEEDED"
    assert result.status == "PARTIAL"


@pytest.mark.asyncio
async def test_everything_failing_is_reported_as_failed(harness):
    harness["script"]["a"] = {"error": "boom"}
    result = await harness["runner"].execute(_spec([_step("a")]))
    assert result.status == "FAILED"


@pytest.mark.asyncio
async def test_partial_is_never_reported_as_completed(harness):
    """The dishonesty this guards against is the whole reason PARTIAL exists."""
    harness["script"]["b"] = {"error": "boom"}
    result = await harness["runner"].execute(_spec([_step("a"), _step("b")]))
    assert result.status == "PARTIAL"


# ── Approval, cancellation, budgets ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_unapproved_write_pauses_the_run(harness):
    harness["script"]["a"] = {"needs_approval": "send an email"}
    result = await harness["runner"].execute(_spec([_step("a"), _step("b", ["a"])]))
    assert result.steps["a"].status == "AWAITING_APPROVAL"
    assert result.status == "AWAITING_ACTION_APPROVAL"


@pytest.mark.asyncio
async def test_cancellation_stops_scheduling(harness):
    harness["store"].cancelled = True
    result = await harness["runner"].execute(
        _spec([_step("a"), _step("b", ["a"]), _step("c", ["b"])])
    )
    assert result.status == "CANCELLED"
    assert any(s.status == "SKIPPED" for s in result.steps.values())


@pytest.mark.asyncio
async def test_run_budget_stops_the_run_and_says_why(harness, monkeypatch):
    monkeypatch.setattr(ex, "RUN_TOOL_CALL_BUDGET", 2)
    harness["script"].update({k: {"tool_calls_used": 2} for k in ("a", "b", "c")})
    result = await harness["runner"].execute(
        _spec([_step("a"), _step("b", ["a"]), _step("c", ["b"])])
    )
    skipped = [s for s in result.steps.values() if s.status == "SKIPPED"]
    assert skipped
    assert any("budget" in (s.error or "") for s in skipped)


@pytest.mark.asyncio
async def test_disabled_steps_never_run(harness):
    result = await harness["runner"].execute(
        _spec([_step("a", enabled=False), _step("b")])
    )
    assert "a" not in harness["order"]
    assert result.steps["a"].status == "DISABLED"


@pytest.mark.asyncio
async def test_dependent_of_a_disabled_step_is_blocked(harness):
    result = await harness["runner"].execute(
        _spec([_step("a", enabled=False), _step("b", ["a"])])
    )
    assert result.steps["b"].status in ("BLOCKED", "SKIPPED")
    assert "b" not in harness["order"]


@pytest.mark.asyncio
async def test_missing_agent_fails_its_step_only(harness):
    harness["runner"]._get_agent = lambda slug: None if slug == "lex" else object()
    result = await harness["runner"].execute(
        _spec([_step("a", agent="lex"), _step("b", agent="sage")])
    )
    assert result.steps["a"].status == "FAILED"
    assert result.steps["b"].status == "SUCCEEDED"


@pytest.mark.asyncio
async def test_progress_is_reported_for_every_step(harness):
    await harness["runner"].execute(_spec([_step("a"), _step("b", ["a"])]))
    # Node needs a terminal status per step to render the live graph.
    assert harness["store"].steps["a"]["status"] == "SUCCEEDED"
    assert harness["store"].steps["b"]["status"] == "SUCCEEDED"
    assert harness["store"].heartbeats, "run must report liveness"
