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


@dataclass
class RunSpec:
    run_id: str
    organization_id: str
    user_id: str
    goal: str
    steps: list[StepSpec]
    write_mode: str = "stage"


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
        state: dict[str, _StepState] = {
            s.key: _StepState(status="PLANNED" if s.enabled else "DISABLED")
            for s in spec.steps
        }
        by_key = {s.key: s for s in spec.steps}
        tool_calls_used = 0
        cancelled = False
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
                metadata={},
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
                tool_budget=min(STEP_TOOL_BUDGET, RUN_TOOL_CALL_BUDGET - tool_calls_used),
            )
            tool_calls_used += outcome.tool_calls_used

            if outcome.needs_approval:
                state[s.key].status = "AWAITING_APPROVAL"
                await self._store.update_step(
                    spec.run_id, s.key, status="AWAITING_APPROVAL",
                    errorMessage=f"waiting on approval: {outcome.needs_approval}",
                    toolTrace=outcome.tool_trace,
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
