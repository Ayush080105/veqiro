"""Runs an approved plan's DAG.

Kahn wave scheduling: every step whose dependencies have succeeded becomes
runnable, and independent steps run concurrently up to a cap. State lives in
Node — this only reports transitions through a RunStore.

Concurrency is capped rather than unbounded because each step is a full LLM
tool loop fanning out to MCP calls, and every one of those is a separate HTTP
round trip to Node over a single shared client. Letting a wide graph fan out
freely is the same mistake as an unbounded Promise.all.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

from core.models import ChatRequest
from core.runs.step import UpstreamContext, run_step
from core.runs.store import RunStore
from agents.planner import MAX_REPLANS

logger = logging.getLogger("run_executor")

MAX_PARALLEL_STEPS = 3
RUN_TOOL_CALL_BUDGET = 60
STEP_TOOL_BUDGET = 20
RUN_TIMEOUT_SECONDS = 30 * 60
HEARTBEAT_INTERVAL = 15.0
#: One retry per step. A second failure means the plan was wrong, not the run.
MAX_ATTEMPTS = 2


@dataclass
class StepSpec:
    key: str
    agent: str
    title: str
    intent: str
    integration_slug: str | None
    depends_on: tuple[str, ...]
    is_write: bool
    enabled: bool = True
    #: Set when a resumed run replays a step that already finished. Such a
    #: step is seeded as SUCCEEDED rather than re-run, so a write is never
    #: performed twice — and, unlike marking it disabled, its dependents stay
    #: runnable and can still read its output.
    prior_status: str | None = None
    prior_output: str = ""


@dataclass
class RunSpec:
    run_id: str
    organization_id: str
    user_id: str
    goal: str
    steps: list[StepSpec]
    write_mode: str = "stage"
    #: agent slug -> that agent's connected MCP connections. Kept per agent
    #: rather than merged so a step can only ever reach integrations its own
    #: agent owns, matching what the planner assigned.
    connections_by_agent: dict = field(default_factory=dict)
    #: Overrides which native tools pause for review. None means the default
    #: set; an empty dict disables review entirely.
    review_tools: dict | None = None
    #: Called once when steps have failed, to plan a way around them. None
    #: disables repair, which is what an unattended run wants: nobody is there
    #: to approve a write the detour introduces.
    repair: object | None = None
    #: agent|integration pairs the user approved. A repair step whose write
    #: falls outside these pauses the run rather than performing it.
    approved_writes: tuple = ()


@dataclass
class _StepState:
    status: str = "PLANNED"
    output_text: str = ""
    error: str | None = None
    attempts: int = 0


@dataclass
class RunResult:
    status: str
    summary: str
    steps: dict[str, _StepState] = field(default_factory=dict)


class RunExecutor:
    def __init__(self, store: RunStore, get_agent, build_system_prompt):
        self._store = store
        self._get_agent = get_agent
        self._build_system_prompt = build_system_prompt

    async def execute(self, spec: RunSpec) -> RunResult:
        started = time.monotonic()
        def _seed(s: StepSpec) -> _StepState:
            if not s.enabled:
                return _StepState(status="DISABLED")
            if s.prior_status == "SUCCEEDED":
                return _StepState(status="SUCCEEDED", output_text=s.prior_output)
            return _StepState(status="PLANNED")

        state: dict[str, _StepState] = {s.key: _seed(s) for s in spec.steps}
        by_key = {s.key: s for s in spec.steps}
        tool_calls_used = 0
        cancelled = False
        replans_used = 0
        # Built once per agent per run: the system prompt is per-request work,
        # not per-step, and rebuilding it each node is what makes reusing
        # chat_sync wasteful.
        prompts: dict[str, str] = {}
        last_beat = 0.0

        def _ready() -> list[StepSpec]:
            out = []
            for s in spec.steps:
                if state[s.key].status != "PLANNED":
                    continue
                deps = [d for d in s.depends_on if d in state]
                if any(state[d].status != "SUCCEEDED" for d in deps):
                    continue
                out.append(s)
            return out

        def _block_dependents(root: str, reason: str) -> None:
            """Anything downstream of a failed or skipped step cannot run."""
            changed = True
            while changed:
                changed = False
                for s in spec.steps:
                    if state[s.key].status != "PLANNED":
                        continue
                    if any(
                        d in state and state[d].status in ("FAILED", "BLOCKED", "DISABLED", "SKIPPED")
                        for d in s.depends_on
                    ):
                        state[s.key].status = "BLOCKED"
                        state[s.key].error = reason
                        changed = True

        async def _beat() -> bool:
            nonlocal last_beat, cancelled
            now = time.monotonic()
            if now - last_beat < HEARTBEAT_INTERVAL:
                return cancelled
            last_beat = now
            reply = await self._store.heartbeat(spec.run_id, tool_calls_used)
            if reply.get("cancelled"):
                cancelled = True
            return cancelled

        async def _run(s: StepSpec) -> None:
            nonlocal tool_calls_used
            agent = self._get_agent(s.agent.lower())
            if agent is None:
                state[s.key].status = "FAILED"
                state[s.key].error = f"agent '{s.agent}' is not available"
                await self._store.update_step(
                    spec.run_id, s.key, status="FAILED", errorMessage=state[s.key].error
                )
                return

            if s.agent.lower() not in prompts:
                prompts[s.agent.lower()] = await self._build_system_prompt(
                    agent, spec.organization_id, spec.user_id
                )

            request = ChatRequest(
                user_id=spec.user_id,
                organization_id=spec.organization_id,
                conversation_id=f"run-{spec.run_id}",
                message=s.intent,
                history=[],
                # _assemble_tools reads connections from here, exactly as a
                # chat turn does. Without them a step sees no MCP tools at all.
                metadata={
                    "mcp_connections": spec.connections_by_agent.get(s.agent.lower(), []),
                },
            )

            upstream = [
                UpstreamContext(key=d, title=by_key[d].title, text=state[d].output_text)
                for d in s.depends_on
                if d in state and state[d].status == "SUCCEEDED"
            ]

            state[s.key].status = "RUNNING"
            state[s.key].attempts += 1
            await self._store.update_step(spec.run_id, s.key, status="RUNNING")

            outcome = await run_step(
                agent,
                request=request,
                run_id=spec.run_id,
                step_key=s.key,
                intent=s.intent,
                system_prompt=prompts[s.agent.lower()],
                store=self._store,
                upstream=upstream,
                integration_slug=s.integration_slug,
                write_mode=spec.write_mode,  # type: ignore[arg-type]
                is_write=s.is_write,
                review_tools=spec.review_tools,
                tool_budget=min(STEP_TOOL_BUDGET, RUN_TOOL_CALL_BUDGET - tool_calls_used),
            )
            tool_calls_used += outcome.tool_calls_used

            if outcome.needs_approval:
                state[s.key].status = "AWAITING_APPROVAL"
                review = outcome.review_request or {}
                await self._store.update_step(
                    spec.run_id, s.key, status="AWAITING_APPROVAL",
                    errorMessage=f"waiting on approval: {outcome.needs_approval}",
                    toolTrace=outcome.tool_trace,
                    # The arguments the model proposed become the prefilled
                    # form the user is shown, so they must survive to Node.
                    proposedActionId=review.get("action_id"),
                    # The step's intent rides along so the console can fill the
                    # form's context field, which no tool argument maps to.
                    proposedArgs={
                        **(review.get("arguments") or {}),
                        "_intent": review.get("intent"),
                    },
                )
                return

            if outcome.error:
                if state[s.key].attempts < MAX_ATTEMPTS:
                    # One retry, with the failure stated so the model can try a
                    # different approach rather than repeat itself.
                    state[s.key].status = "PLANNED"
                    s.intent = (
                        f"{s.intent}\n\nYour previous attempt failed with: "
                        f"{outcome.error}. Try a different approach."
                    )
                    return
                state[s.key].status = "FAILED"
                state[s.key].error = outcome.error
                await self._store.update_step(
                    spec.run_id, s.key, status="FAILED",
                    errorMessage=outcome.error, toolTrace=outcome.tool_trace,
                    attempt=state[s.key].attempts,
                )
                _block_dependents(s.key, f"depends on {s.key}, which failed")
                return

            # An unattended step proposes writes instead of performing them.
            # They are the run's real output, so they go to Node as approval
            # cards, and the step is honest about not being finished: the write
            # has not happened, so anything depending on it cannot proceed.
            if outcome.pending_actions:
                await self._store.stage_actions(
                    spec.run_id, s.key, outcome.pending_actions
                )
                state[s.key].status = "AWAITING_APPROVAL"
                state[s.key].output_text = outcome.text
                await self._store.update_step(
                    spec.run_id, s.key, status="AWAITING_APPROVAL",
                    outputText=outcome.text, toolTrace=outcome.tool_trace,
                    errorMessage=(
                        f"proposed {len(outcome.pending_actions)} action"
                        f"{'' if len(outcome.pending_actions) == 1 else 's'} "
                        "for you to approve"
                    ),
                )
                _block_dependents(s.key, f"depends on {s.key}, which is awaiting approval")
                return

            state[s.key].status = "SUCCEEDED"
            state[s.key].output_text = outcome.text
            action_id, action_result = (
                outcome.rich_results[0] if outcome.rich_results else (None, None)
            )
            await self._store.update_step(
                spec.run_id, s.key, status="SUCCEEDED",
                outputText=outcome.text, toolTrace=outcome.tool_trace,
                actionId=action_id, actionResult=action_result,
                attempt=state[s.key].attempts,
            )

        # ── Wave loop ────────────────────────────────────────────────────
        while True:
            if await _beat():
                break
            if time.monotonic() - started > RUN_TIMEOUT_SECONDS:
                break
            if tool_calls_used >= RUN_TOOL_CALL_BUDGET:
                break

            wave = _ready()[:MAX_PARALLEL_STEPS]
            if not wave:
                break
            await asyncio.gather(*(_run(s) for s in wave))

        # -- Repair -------------------------------------------------------
        # One pass, and only once the waves have drained: every step that
        # could still run has run, so what is left is genuinely stuck.
        if (
            spec.repair is not None
            and not cancelled
            and replans_used < MAX_REPLANS
            and any(st.status == "FAILED" for st in state.values())
            and tool_calls_used < RUN_TOOL_CALL_BUDGET
        ):
            replans_used += 1
            added = await self._repair(spec, state, by_key)
            for s_new in added:
                spec.steps.append(s_new)
                by_key[s_new.key] = s_new
                state[s_new.key] = _StepState(status="PLANNED")
            # Blocked steps stay blocked: the repair replaces them rather than
            # reviving work whose inputs never arrived.
            while added:
                if await _beat():
                    break
                if tool_calls_used >= RUN_TOOL_CALL_BUDGET:
                    break
                wave = _ready()[:MAX_PARALLEL_STEPS]
                if not wave:
                    break
                await asyncio.gather(*(_run(s) for s in wave))

        # Anything never reached is skipped, with an honest reason.
        for s in spec.steps:
            if state[s.key].status in ("PLANNED", "RUNNING"):
                state[s.key].status = "SKIPPED"
                state[s.key].error = (
                    "run cancelled" if cancelled
                    else "run budget exhausted" if tool_calls_used >= RUN_TOOL_CALL_BUDGET
                    else "not reached"
                )
                await self._store.update_step(
                    spec.run_id, s.key, status="SKIPPED", errorMessage=state[s.key].error
                )

        return RunResult(status=self._terminal_status(spec, state, cancelled),
                         summary="", steps=state)

    async def _repair(self, spec: RunSpec, state: dict, by_key: dict) -> list[StepSpec]:
        """Plan around the failures, and register the detour with Node.

        Returns the steps to run, or an empty list to stop and report the
        failures honestly - the right answer when a failure has no way around
        it, which is common (an integration is disconnected, an account lacks
        permission).
        """
        def _rows(status: str) -> list[dict]:
            return [
                {
                    "key": k,
                    "title": by_key[k].title,
                    "agent": by_key[k].agent,
                    "error": st.error,
                    "output": st.output_text,
                }
                for k, st in state.items()
                if st.status == status and k in by_key
            ]

        try:
            plan = await spec.repair(
                goal=spec.goal,
                succeeded=_rows("SUCCEEDED"),
                failed=_rows("FAILED"),
                blocked=_rows("BLOCKED"),
                existing_keys=set(state),
            )
        except Exception:
            logger.warning("repair planning failed | run=%s", spec.run_id, exc_info=True)
            return []
        if plan is None or not plan.nodes:
            return []

        def _signature(node) -> str:
            return node.agent.upper() + "|" + (node.integration_slug or "")

        # A detour that writes something the user never approved is precisely
        # what plan-level approval does not cover, so it is dropped rather than
        # performed. Dropping only the write keeps the readable half of a
        # repair usable.
        approved = set(spec.approved_writes)
        usable = [n for n in plan.nodes if not n.is_write or _signature(n) in approved]
        if not usable:
            return []
        kept = {n.key for n in usable}

        def _deps(node) -> tuple:
            # A dependency on a dropped step, or on one that never succeeded,
            # would leave the new step permanently unready.
            done = {k for k, st in state.items() if st.status == "SUCCEEDED"}
            return tuple(d for d in node.depends_on if d in kept or d in done)

        steps = [
            StepSpec(
                key=n.key,
                agent=n.agent,
                title=n.title,
                intent=n.intent,
                integration_slug=n.integration_slug,
                depends_on=_deps(n),
                is_write=n.is_write,
            )
            for n in usable
        ]

        ok = await self._store.add_steps(
            spec.run_id,
            [
                {
                    "key": st.key,
                    "agent": st.agent,
                    "title": st.title,
                    "intent": st.intent,
                    "integrationSlug": st.integration_slug,
                    "dependsOn": list(st.depends_on),
                    "isWrite": st.is_write,
                }
                for st in steps
            ],
        )
        # Without a row per step the user would watch a graph that never
        # mentions the work being done, so a failure here stops the repair.
        return steps if ok else []

    @staticmethod
    def _terminal_status(spec: RunSpec, state: dict[str, _StepState], cancelled: bool) -> str:
        if cancelled:
            return "CANCELLED"
        enabled = [s for s in spec.steps if s.enabled]
        statuses = [state[s.key].status for s in enabled]
        if any(s == "AWAITING_APPROVAL" for s in statuses):
            return "AWAITING_ACTION_APPROVAL"
        succeeded = sum(1 for s in statuses if s == "SUCCEEDED")
        if succeeded == len(enabled):
            return "COMPLETED"
        if succeeded == 0:
            return "FAILED"
        # Something worked and something did not — never report this as done.
        return "PARTIAL"
