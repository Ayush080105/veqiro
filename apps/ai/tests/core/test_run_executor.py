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
            pending_actions=cfg.get("pending_actions", []),
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


# ── Resume ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_resume_does_not_rerun_finished_steps(harness):
    """The whole point of resume: a write must never happen twice."""
    result = await harness["runner"].execute(
        _spec([
            _step("a", prior_status="SUCCEEDED", prior_output="earlier result"),
            _step("b", ["a"]),
        ])
    )
    assert "a" not in harness["order"], "a finished before the crash"
    assert harness["order"] == ["b"]
    assert result.steps["a"].status == "SUCCEEDED"
    assert result.status == "COMPLETED"


@pytest.mark.asyncio
async def test_resume_keeps_dependents_runnable(harness):
    """Regression: seeding a finished step as DISABLED blocked everything
    downstream, so a resumed run stalled exactly where it crashed."""
    result = await harness["runner"].execute(
        _spec([
            _step("a", prior_status="SUCCEEDED", prior_output="x"),
            _step("b", ["a"]),
            _step("c", ["b"]),
        ])
    )
    assert result.steps["b"].status == "SUCCEEDED"
    assert result.steps["c"].status == "SUCCEEDED"


@pytest.mark.asyncio
async def test_resume_feeds_prior_output_to_dependents(harness, monkeypatch):
    """A resumed step's output is the input its dependents read — losing it
    would make them run against nothing."""
    seen: list[str] = []

    async def capture(agent, *, step_key, upstream=(), **kwargs):
        seen.extend(u.text for u in upstream)
        return StepOutcome(text=f"{step_key} done", tool_calls_used=1)

    monkeypatch.setattr(ex, "run_step", capture)
    await harness["runner"].execute(
        _spec([
            _step("a", prior_status="SUCCEEDED", prior_output="the earlier result"),
            _step("b", ["a"]),
        ])
    )
    assert "the earlier result" in seen


@pytest.mark.asyncio
async def test_user_disabled_step_still_blocks_dependents(harness):
    """Disabled and already-finished must stay distinct: a step the user
    switched off genuinely did not run."""
    result = await harness["runner"].execute(
        _spec([_step("a", enabled=False), _step("b", ["a"])])
    )
    assert result.steps["a"].status == "DISABLED"
    assert result.steps["b"].status in ("BLOCKED", "SKIPPED")


# ── Tool scoping ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_each_step_sees_only_its_own_agent_connections(harness, monkeypatch):
    """A merged connection list would let a step reach an integration its agent
    does not own, undoing the ownership rule the planner enforces."""
    seen: dict[str, list] = {}

    async def capture(agent, *, step_key, request, **kwargs):
        seen[step_key] = request.metadata.get("mcp_connections", [])
        return StepOutcome(text="ok", tool_calls_used=1)

    monkeypatch.setattr(ex, "run_step", capture)
    await harness["runner"].execute(
        RunSpec(
            run_id="run-1", organization_id="org", user_id="user", goal="g",
            steps=[_step("a", agent="vega"), _step("b", agent="sage")],
            connections_by_agent={
                "vega": [{"connectionId": "c1", "integrationSlug": "gmail"}],
                "sage": [{"connectionId": "c2", "integrationSlug": "google-search-console"}],
            },
        )
    )
    assert [c["integrationSlug"] for c in seen["a"]] == ["gmail"]
    assert [c["integrationSlug"] for c in seen["b"]] == ["google-search-console"]


@pytest.mark.asyncio
async def test_step_for_an_agent_with_no_connections_gets_an_empty_list(harness, monkeypatch):
    seen = {}

    async def capture(agent, *, step_key, request, **kwargs):
        seen[step_key] = request.metadata.get("mcp_connections")
        return StepOutcome(text="ok", tool_calls_used=1)

    monkeypatch.setattr(ex, "run_step", capture)
    await harness["runner"].execute(
        RunSpec(
            run_id="run-1", organization_id="org", user_id="user", goal="g",
            steps=[_step("a", agent="lex")],
            connections_by_agent={"vega": [{"connectionId": "c1"}]},
        )
    )
    assert seen["a"] == []


# ── Repair ──────────────────────────────────────────────────────────────────

def _plan(nodes):
    """A minimal stand-in for planner.Plan — only .nodes is read."""
    return type("P", (), {"nodes": nodes})()


def _node(key, agent="sage", is_write=False, integration=None, deps=()):
    return type("N", (), {
        "key": key, "agent": agent, "title": f"Repair {key}",
        "intent": f"do {key}", "integration_slug": integration,
        "depends_on": tuple(deps), "is_write": is_write,
        "expected_scope": None,
    })()


def _repairing(nodes, calls=None):
    async def repair(**kw):
        if calls is not None:
            calls.append(kw)
        return _plan(nodes)
    return repair


@pytest.mark.asyncio
async def test_repair_runs_a_detour_around_a_failed_step(harness):
    harness["script"]["a"] = {"error": "gsc is disconnected"}
    result = await harness["runner"].execute(
        _spec([_step("a")], repair=_repairing([_node("r1")]))
    )
    assert "r1" in harness["order"], "the detour should actually run"
    assert result.steps["r1"].status == "SUCCEEDED"
    assert harness["store"].added_steps, "Node must have a row for the new step"


@pytest.mark.asyncio
async def test_repair_happens_only_once(harness):
    """A plan that fails twice is wrong about the world, not unlucky."""
    calls = []
    harness["script"]["a"] = {"error": "boom"}
    harness["script"]["r1"] = {"error": "boom again"}
    await harness["runner"].execute(
        _spec([_step("a")], repair=_repairing([_node("r1")], calls))
    )
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_no_repair_when_nothing_failed(harness):
    calls = []
    await harness["runner"].execute(
        _spec([_step("a")], repair=_repairing([_node("r1")], calls))
    )
    assert calls == []


@pytest.mark.asyncio
async def test_repair_is_told_what_already_succeeded(harness):
    """It must not replan finished work — a repeated write would happen twice."""
    calls = []
    harness["script"]["b"] = {"error": "boom"}
    await harness["runner"].execute(
        _spec([_step("a"), _step("b")], repair=_repairing([_node("r1")], calls))
    )
    assert [r["key"] for r in calls[0]["succeeded"]] == ["a"]
    assert [r["key"] for r in calls[0]["failed"]] == ["b"]


@pytest.mark.asyncio
async def test_repair_drops_a_write_the_user_never_approved(harness):
    """Plan approval covered the original writes, not one a detour invents."""
    harness["script"]["a"] = {"error": "boom"}
    result = await harness["runner"].execute(
        _spec(
            [_step("a")],
            repair=_repairing([_node("r1", agent="vega", is_write=True, integration="gmail")]),
            approved_writes=(),
        )
    )
    assert "r1" not in harness["order"]
    assert result.status == "FAILED"


@pytest.mark.asyncio
async def test_repair_keeps_a_write_that_was_approved(harness):
    harness["script"]["a"] = {"error": "boom"}
    await harness["runner"].execute(
        _spec(
            [_step("a")],
            repair=_repairing([_node("r1", agent="vega", is_write=True, integration="gmail")]),
            approved_writes=("VEGA|gmail",),
        )
    )
    assert "r1" in harness["order"]


@pytest.mark.asyncio
async def test_repair_that_cannot_be_recorded_does_not_run(harness):
    """Running steps Node has no row for would leave the user watching a graph
    that never mentions the work."""
    harness["store"].add_steps_ok = False
    harness["script"]["a"] = {"error": "boom"}
    await harness["runner"].execute(
        _spec([_step("a")], repair=_repairing([_node("r1")]))
    )
    assert "r1" not in harness["order"]


@pytest.mark.asyncio
async def test_repair_returning_nothing_reports_the_failure_honestly(harness):
    async def gives_up(**kw):
        return None

    harness["script"]["a"] = {"error": "gsc is disconnected"}
    result = await harness["runner"].execute(_spec([_step("a")], repair=gives_up))

    assert result.status == "FAILED"
    assert result.steps["a"].error == "gsc is disconnected"


@pytest.mark.asyncio
async def test_repair_dependency_on_a_dropped_step_is_pruned(harness):
    """Otherwise the new step waits forever on a step that was never added."""
    harness["script"]["a"] = {"error": "boom"}
    await harness["runner"].execute(
        _spec(
            [_step("a")],
            repair=_repairing([
                _node("r1", agent="vega", is_write=True, integration="gmail"),  # dropped
                _node("r2", deps=["r1"]),
            ]),
            approved_writes=(),
        )
    )
    assert "r2" in harness["order"], "r2 must not wait on the dropped write"


# ── Unattended runs ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_a_staged_write_is_handed_to_node(harness):
    """The whole point of an unattended run: nobody was watching, so the write
    becomes a card. Dropping it turns a useful run into one that read a lot and
    offered nothing."""
    harness["script"]["a"] = {
        "pending_actions": [{"id": "p1", "connection_id": "c1",
                             "tool_name": "GMAIL_SEND", "arguments": {},
                             "summary": "Send the digest"}],
    }
    await harness["runner"].execute(_spec([_step("a")]))

    assert harness["store"].staged, "the proposal must reach Node"
    key, actions = harness["store"].staged[0]
    assert key == "a"
    assert actions[0]["summary"] == "Send the digest"


@pytest.mark.asyncio
async def test_a_step_that_staged_a_write_is_not_reported_as_done(harness):
    """The write has not happened yet — calling the step succeeded would claim
    work that is still waiting on a human."""
    harness["script"]["a"] = {
        "pending_actions": [{"id": "p1", "connection_id": "c1",
                             "tool_name": "GMAIL_SEND", "arguments": {}, "summary": "s"}],
    }
    result = await harness["runner"].execute(_spec([_step("a")]))

    assert result.steps["a"].status == "AWAITING_APPROVAL"
    assert result.status == "AWAITING_ACTION_APPROVAL"


@pytest.mark.asyncio
async def test_dependents_of_a_staged_write_do_not_run(harness):
    """A step downstream of a write that has not happened would run against a
    world it wrongly assumes changed."""
    harness["script"]["a"] = {
        "pending_actions": [{"id": "p1", "connection_id": "c1",
                             "tool_name": "GMAIL_SEND", "arguments": {}, "summary": "s"}],
    }
    result = await harness["runner"].execute(
        _spec([_step("a"), _step("b", ["a"])])
    )

    assert "b" not in harness["order"]
    assert result.steps["b"].status in ("BLOCKED", "SKIPPED")


@pytest.mark.asyncio
async def test_reads_still_run_alongside_a_staged_write(harness):
    """An unattended run must not stall entirely — the readable half is the
    part that can be delivered without asking anyone."""
    harness["script"]["a"] = {
        "pending_actions": [{"id": "p1", "connection_id": "c1",
                             "tool_name": "GMAIL_SEND", "arguments": {}, "summary": "s"}],
    }
    result = await harness["runner"].execute(_spec([_step("a"), _step("b")]))

    assert result.steps["b"].status == "SUCCEEDED"
