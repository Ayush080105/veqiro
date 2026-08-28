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
from agents.registry import _AGENT_DESCRIPTIONS
from core.llm import LLMClient
from core.mcp.cache import get_mcp_tools

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
