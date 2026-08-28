"""Planning endpoint for multi-step runs.

Called by Node's agent-runs service on a chat turn that looks multi-step. Node
owns run state and every authorisation decision; this endpoint only decides
whether a request decomposes into a DAG and, if so, what that DAG is.

A `{"planned": false}` response is the normal, expected outcome — Node then
takes today's single-pass path. Nothing here should ever raise into Node's
critical path.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from agents import planner
from agents.registry import _AGENT_DESCRIPTIONS, get_agent
from core.llm import LLMClient
from core.mcp.cache import get_mcp_tools
from core.runs.executor import RunExecutor, RunSpec, StepSpec
from core.runs.store import HttpRunStore

logger = logging.getLogger("run_routes")

router = APIRouter(prefix="/ai/runs", tags=["Runs"])

_llm = LLMClient()

# Names only, and only enough of them to characterise the integration. The
# planner needs to know a tool exists, not how to call it — the executing agent
# resolves real schemas at step time.
_MAX_TOOL_NAMES_PER_INTEGRATION = 40


class PlanRequest(BaseModel):
    organization_id: str
    agent: str
    message: str
    # Shapes mirror what contextService.ts already assembles for a chat turn.
    mcp_connections: list[dict] = Field(default_factory=list)
    mcp_catalog: list[dict] = Field(default_factory=list)
    # Agents the planner may assign steps to. Node sends the org's entitled
    # set for a team run, or the single agent for a normal chat. Empty means
    # "just the requesting agent" — never "all of them", so a mistake here
    # cannot hand work to an agent the org has not paid for.
    allowed_agents: list[str] = Field(default_factory=list)
    # Team room: always produce a graph, even a single node. The graph is the
    # surface there — it shows which agent and which connection will do the
    # work — so skipping it for a one-step request would leave the room looking
    # like a worse copy of an individual chat.
    force: bool = False


class PlanNodeOut(BaseModel):
    key: str
    title: str
    agent: str
    intent: str
    integration_slug: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    is_write: bool = False
    expected_scope: str | None = None


class PlanOut(BaseModel):
    goal: str
    nodes: list[PlanNodeOut]
    unavailable: list[dict] = Field(default_factory=list)
    final_deliverables: list[str] = Field(default_factory=list)
    planner_meta: dict = Field(default_factory=dict)


class PlanResponse(BaseModel):
    planned: bool
    plan: PlanOut | None = None
    reason: str = ""


async def _tool_names_by_slug(
    organization_id: str, agent_slug: str, connections: list[dict]
) -> dict[str, list[str]]:
    """Per-integration tool names, sourced from the same cache the executor
    will use so the planner cannot promise a tool the step will not see."""
    # One entry per integration. Fetched concurrently: the team room passes the
    # union across every entitled agent, and doing a dozen cold round trips
    # sequentially blew the caller's planning timeout.
    unique: dict[str, dict] = {}
    for conn in connections:
        slug = conn.get("integrationSlug") or conn.get("toolkitSlug")
        if slug and slug not in unique:
            unique[slug] = conn

    async def _names(slug: str, conn: dict) -> tuple[str, list[str]]:
        try:
            defs, _ = await get_mcp_tools(organization_id, agent_slug, [conn])
        except Exception:
            logger.warning("tool listing failed for %s", slug, exc_info=True)
            return slug, []
        prefix = f"mcp_{slug}_"
        return slug, [
            d.name[len(prefix):] if d.name.startswith(prefix) else d.name
            for d in defs
        ][:_MAX_TOOL_NAMES_PER_INTEGRATION]

    results = await asyncio.gather(
        *(_names(slug, conn) for slug, conn in unique.items())
    )
    # An empty list means the listing failed, not that the integration has no
    # tools. Dropping it keeps the planner from being told "this has nothing".
    return {slug: names for slug, names in results if names}


@router.post("/plan", response_model=PlanResponse)
async def plan_run(body: PlanRequest) -> PlanResponse:
    """Decide whether a request is multi-step, and decompose it if so."""
    connected = {
        c.get("slug", ""): c.get("name", "")
        for c in body.mcp_catalog
        if c.get("connected") and c.get("slug")
    }
    # Fall back to the connection list when the catalog is absent — a planned
    # run against nothing connected cannot deliver anything.
    if not connected:
        connected = {
            (c.get("integrationSlug") or c.get("toolkitSlug") or ""): ""
            for c in body.mcp_connections
        }
        connected.pop("", None)
    if not connected:
        return PlanResponse(planned=False, reason="no connected integrations")

    gate = planner.should_plan(body.message, connected=connected)
    if not body.force:
        if gate.verdict == "no":
            return PlanResponse(planned=False, reason=f"gate: {gate.reason}")
        if gate.verdict == "maybe" and not await planner.confirm_with_model(_llm, body.message):
            return PlanResponse(planned=False, reason=f"gate model declined ({gate.reason})")

    allowed = [a.lower() for a in body.allowed_agents] or [body.agent.lower()]
    agent_descriptions = {
        slug: desc for slug, desc in _AGENT_DESCRIPTIONS.items() if slug in allowed
    }
    if not agent_descriptions:
        return PlanResponse(planned=False, reason="no agents available to plan with")

    catalog = body.mcp_catalog or [
        {"slug": s, "name": n or s, "connected": True} for s, n in connected.items()
    ]
    tool_names = await _tool_names_by_slug(
        body.organization_id, body.agent, body.mcp_connections
    )

    plan = await planner.build_plan(
        _llm,
        body.message,
        agent_descriptions=agent_descriptions,
        catalog=catalog,
        tool_names_by_slug=tool_names,
        connected_slugs=set(connected),
        gate_score=gate.score,
        min_nodes=1 if body.force else planner.MIN_NODES,
    )
    if plan is None:
        return PlanResponse(planned=False, reason="planner produced no usable plan")

    return PlanResponse(
        planned=True,
        plan=PlanOut(
            goal=plan.goal,
            nodes=[
                PlanNodeOut(
                    key=n.key,
                    title=n.title,
                    agent=n.agent,
                    intent=n.intent,
                    integration_slug=n.integration_slug,
                    depends_on=list(n.depends_on),
                    is_write=n.is_write,
                    expected_scope=n.expected_scope,
                )
                for n in plan.nodes
            ],
            unavailable=[dict(u) for u in plan.unavailable],
            final_deliverables=list(plan.final_deliverables),
            planner_meta={
                "model": plan.model_used,
                "gate_score": plan.gate_score,
                "gate_reason": gate.reason,
                "node_count": len(plan.nodes),
            },
        ),
    )


# ── Execution ───────────────────────────────────────────────────────────────

class ExecuteStepIn(BaseModel):
    key: str
    agent: str
    title: str
    intent: str
    integration_slug: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    is_write: bool = False
    enabled: bool = True
    # Present only on a resume, so finished work is not repeated.
    prior_status: str | None = None
    prior_output: str = ""


class ExecuteRequest(BaseModel):
    run_id: str
    organization_id: str
    user_id: str
    goal: str
    steps: list[ExecuteStepIn]
    # "stage" for unattended runs (writes become PENDING cards); "execute" for
    # a plan the user approved in the UI.
    write_mode: str = "stage"
    # agent slug -> connections, as Node resolved them per agent.
    connections_by_agent: dict = Field(default_factory=dict)


class ExecuteResponse(BaseModel):
    accepted: bool
    reason: str = ""


#: Runs this process is currently executing. The sweeper re-dispatches a run
#: whose heartbeat has gone quiet, and a re-dispatch that lands while the
#: original task is merely slow — not dead — would run every step twice.
_inflight: set[str] = set()


async def _build_step_prompt(agent, organization_id: str, user_id: str) -> str:
    """The agent's own prompt, built once per agent per run.

    Deliberately without RAG or memory: a planned step is given its intent and
    its upstream results explicitly, and re-running retrieval for every node is
    the per-step cost the planner exists to avoid.
    """
    prompt = await agent.build_system_prompt(user_id, organization_id)
    prompt += agent.get_tool_instructions()
    return prompt


#: Deliberately the planner's model, not a cheap one: this text is the entire
#: answer the user reads, and it must not overstate a partial run.
SUMMARY_MAX_CHARS_PER_STEP = 4_000


async def _summarize(spec: "RunSpec", result) -> str:
    """Turn finished step outputs into the answer the user actually reads."""
    done = [(s, result.steps[s.key]) for s in spec.steps if s.key in result.steps]
    succeeded = [(s, st) for s, st in done if st.status == "SUCCEEDED"]
    problems = [
        (s, st) for s, st in done
        if st.status in ("FAILED", "BLOCKED", "SKIPPED", "AWAITING_APPROVAL")
    ]
    if not succeeded and not problems:
        return ""

    blocks = []
    for s, st in succeeded:
        text = (st.output_text or "").strip()[:SUMMARY_MAX_CHARS_PER_STEP]
        blocks.append(f"### {s.title} ({s.agent})\n{text}")
    for s, st in problems:
        blocks.append(f"### {s.title} ({s.agent}) - {st.status}\n{st.error or ''}")

    provider, model = planner.PLANNER_MODEL
    try:
        return await _llm.complete(
            provider=provider,
            model=model,
            system=(
                "You are writing the final answer for a multi-step task that has "
                "just finished. Write it for the person who asked, in their terms.\n\n"
                "Rules:\n"
                "- Lead with what they asked for, not with a description of the process.\n"
                "- Use only what the step results below actually say. Never invent a "
                "detail, a number, or a link that is not there.\n"
                "- Any step marked FAILED, BLOCKED, SKIPPED or AWAITING_APPROVAL did "
                "NOT happen. Say so plainly and say what is missing because of it. "
                "Never describe such a step as done.\n"
                "- No preamble, no sign-off."
            ),
            messages=[{
                "role": "user",
                "content": f"The task was: {spec.goal}\n\n" + "\n\n".join(blocks),
            }],
        )
    except Exception:
        logger.warning("summary generation failed | run=%s", spec.run_id, exc_info=True)
        # Falling back to the raw blocks keeps a finished run readable rather
        # than losing every result to one failed LLM call.
        return "\n\n".join(blocks)


async def _execute(spec: "RunSpec", run_id: str) -> None:
    store = HttpRunStore()
    try:
        result = await RunExecutor(
            store,
            get_agent=get_agent,
            build_system_prompt=_build_step_prompt,
        ).execute(spec)
        summary = await _summarize(spec, result)
        await store.finish(run_id, result.status, summary)
    except Exception as exc:
        logger.exception("run execution crashed | run=%s", run_id)
        # Node must never be left with a RUNNING row no one is advancing: the
        # sweeper would keep re-dispatching a run that crashes deterministically.
        await store.finish(run_id, "FAILED", "", str(exc))
    finally:
        _inflight.discard(run_id)


@router.post("/execute", response_model=ExecuteResponse)
async def execute_run(body: ExecuteRequest) -> ExecuteResponse:
    """Start executing an approved plan, in the background.

    Returns as soon as the task is scheduled — a run takes minutes, and Node's
    approve request cannot wait for it. Progress arrives back over the internal
    run routes.
    """
    if body.run_id in _inflight:
        return ExecuteResponse(accepted=False, reason="already running in this process")

    steps = [
        StepSpec(
            key=s.key,
            agent=s.agent,
            title=s.title,
            intent=s.intent,
            integration_slug=s.integration_slug,
            depends_on=tuple(s.depends_on),
            is_write=s.is_write,
            enabled=s.enabled,
            prior_status=s.prior_status,
            prior_output=s.prior_output,
        )
        for s in body.steps
    ]
    # A resume whose remaining work is empty has nothing to do — every enabled
    # step already succeeded.
    if not any(s.enabled and s.prior_status != "SUCCEEDED" for s in steps):
        return ExecuteResponse(accepted=False, reason="nothing left to run")

    spec = RunSpec(
        run_id=body.run_id,
        organization_id=body.organization_id,
        user_id=body.user_id,
        goal=body.goal,
        steps=steps,
        write_mode=body.write_mode,
        connections_by_agent=body.connections_by_agent,
    )
    _inflight.add(body.run_id)
    # Held so the task is not garbage-collected mid-run: asyncio keeps only a
    # weak reference to bare tasks.
    task = asyncio.create_task(_execute(spec, body.run_id))
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)
    return ExecuteResponse(accepted=True)


_running_tasks: set[asyncio.Task] = set()
