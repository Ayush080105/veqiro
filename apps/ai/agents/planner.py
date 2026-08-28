"""Decomposes a multi-step request into a task-graph DAG.

Deliberately not a BaseAgent subclass: it has no personality, no RAG, no brand
kit, and — unlike the agents in registry.py — must never become a process-wide
singleton holding per-request state.

Two-part design:

1. `should_plan` is a cheap scored heuristic that decides whether planning is
   worth attempting at all. Most turns are single-step and must keep today's
   latency, so the LLM is only consulted for the ambiguous middle band.
2. `build_plan` asks the model for a DAG, then validates it hard. An LLM will
   emit unknown agents, dangling dependencies and occasionally a cycle.

The safety property that matters: on ANY failure — gate, model, parse, or
validation — the caller falls back to today's single-pass chat_sync and no run
is created. The planner can never make a turn worse than it is now.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, replace
from typing import Literal

from core.llm import LLMClient
from core.config import settings

logger = logging.getLogger("planner")

# Both the plan and the gate run on the main model. Planning a
# cross-integration DAG over a live tool catalogue is a much harder task than
# 6-way intent routing, it happens once per run, and a bad plan wastes dozens
# of tool calls — so quality wins over the cheaper option on both calls.
PLANNER_MODEL = ("openai", "gpt-5.6-luna")
GATE_MODEL = PLANNER_MODEL

MIN_NODES = 2
MAX_NODES = 12

Verdict = Literal["no", "maybe", "yes"]

_SEQUENCING = re.compile(
    r"\b(then|after that|afterwards|once (?:that|you|it)|finally|next,|"
    r"and then|followed by|subsequently)\b",
    re.I,
)
_IMPERATIVES = (
    "audit", "cross-check", "crosscheck", "compare", "open", "create", "draft",
    "send", "update", "summarise", "summarize", "export", "prioritise",
    "prioritize", "file", "review", "pull", "fetch", "analyse", "analyze",
    "publish", "schedule", "reconcile", "check", "find", "write", "post",
    "track", "collect", "monitor",
)

# Stripped when deriving what a user is likely to call an integration: people
# say "my calendar" and "the docs", never "google-calendar".
_VENDOR_PREFIXES = ("google", "microsoft", "ms", "meta", "outlook")
_COLLECTION = re.compile(
    r"\b(for each|top \d+|every (?:page|post|lead|row|contact|issue))\b", re.I
)
_ENUMERATED = re.compile(r"(^\s*\d+[.)]\s+.+){2,}", re.M)
_KEY_RE = re.compile(r"^[a-z0-9_-]{1,16}$")


@dataclass(frozen=True)
class PlanNode:
    key: str
    title: str
    agent: str
    intent: str
    integration_slug: str | None
    depends_on: tuple[str, ...]
    is_write: bool
    expected_scope: str | None


@dataclass(frozen=True)
class Plan:
    goal: str
    nodes: tuple[PlanNode, ...]
    unavailable: tuple[dict, ...]
    final_deliverables: tuple[str, ...]
    model_used: str
    gate_score: int


@dataclass(frozen=True)
class GateResult:
    verdict: Verdict
    score: int
    reason: str


def _match_tokens(slug: str, name: str) -> set[str]:
    """What a user might plausibly call this integration.

    Exact slug/name matching alone missed the common case: "check what's on my
    calendar" never contains "google-calendar" or "Google Calendar". Vendor
    prefixes are therefore stripped to yield the bare noun as well.
    """
    tokens = {slug.replace("-", " ")}
    if name:
        tokens.add(name.lower())
    parts = slug.split("-")
    if len(parts) > 1 and parts[0] in _VENDOR_PREFIXES:
        tokens.add(" ".join(parts[1:]))
    # Short tokens produce false positives out of ordinary prose.
    return {t for t in tokens if len(t) >= 4}


def _mentions(text: str, slug: str, name: str) -> bool:
    """Word-boundary match, so "meet" does not fire on "meeting"."""
    return any(
        re.search(rf"\b{re.escape(tok)}\b", text)
        for tok in _match_tokens(slug, name)
    )


def should_plan(
    message: str,
    *,
    connected: dict[str, str],
) -> GateResult:
    """Score how multi-step a request looks. No LLM call.

    `connected` maps integration slug -> display name. Mentions are matched
    against what the org has actually *connected*, not the whole catalogue:
    "post this to Slack" is a single step for an org that only connected Slack,
    and there is nothing to cross-check against. Counting is per slug, so
    naming an integration by both its slug and its display name is one mention,
    not two.
    """
    text = message.lower()
    words = message.split()
    score = 0
    reasons: list[str] = []

    named = {slug for slug, name in connected.items() if _mentions(text, slug, name)}
    if len(named) >= 2:
        score += 3
        reasons.append(f"{len(named)} connected integrations named")

    if _SEQUENCING.search(text):
        score += 2
        reasons.append("sequencing language")

    verbs = {v for v in _IMPERATIVES if re.search(rf"\b{re.escape(v)}\b", text)}
    if len(verbs) >= 3:
        score += 2
        reasons.append(f"{len(verbs)} distinct actions")

    if _ENUMERATED.search(message) or message.count(";") >= 2 or text.count(" and ") >= 2:
        score += 1
        reasons.append("enumerated request")

    if _COLLECTION.search(text):
        score += 1
        reasons.append("operates over a collection")

    if len(words) > 25:
        score += 1
        reasons.append("long request")

    if len(words) <= 6:
        score -= 5
        reasons.append("very short")

    verdict: Verdict = "no" if score < 2 else ("yes" if score >= 4 else "maybe")
    return GateResult(verdict=verdict, score=score, reason="; ".join(reasons) or "no signals")


async def confirm_with_model(llm: LLMClient, message: str) -> bool:
    """Break the ambiguous 2-3 band. Falls back to 'no' on any failure.

    Mirrors agents/router.py's classifier: cheap model, tiny JSON, deterministic
    fallback — and the fallback is toward today's behaviour, never toward
    spending more.
    """
    if settings.MOCK_MODE:
        return False
    system = (
        "Decide whether a request needs MULTIPLE distinct steps across different "
        "systems, or is a single task.\n"
        "Multi-step means: it reads from one place and acts on another, or it "
        "sequences several actions that depend on each other.\n"
        'Respond in JSON: {"multi_step": true|false, "confidence": 0.0-1.0, "reason": "..."}'
    )
    try:
        provider, model = GATE_MODEL
        data = await llm.complete_json(
            provider=provider,
            model=model,
            system=system,
            messages=[{"role": "user", "content": message}],
            temperature=0.1,
        )
        return bool(data.get("multi_step")) and float(data.get("confidence", 0)) >= 0.6
    except Exception:
        logger.warning("planner gate failed; falling back to single-pass", exc_info=True)
        return False


def _has_cycle(nodes: list[PlanNode]) -> bool:
    """Kahn. A cyclic plan is rejected wholesale rather than repaired —
    silently dropping a back-edge produces a plan that runs but is not the one
    the model reasoned about, which is worse than not planning at all.
    """
    indegree = {n.key: 0 for n in nodes}
    children: dict[str, list[str]] = {n.key: [] for n in nodes}
    for n in nodes:
        for dep in n.depends_on:
            indegree[n.key] += 1
            children[dep].append(n.key)
    queue = [k for k, d in indegree.items() if d == 0]
    seen = 0
    while queue:
        k = queue.pop()
        seen += 1
        for child in children[k]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    return seen != len(nodes)


def validate_plan(
    raw: dict,
    *,
    known_agents: set[str],
    connected_slugs: set[str],
    gate_score: int = 0,
    model_used: str = "",
    min_nodes: int = MIN_NODES,
    owners_by_slug: dict[str, list[str]] | None = None,
) -> Plan | None:
    """Turn model output into a Plan, or None if it cannot be trusted."""
    if not isinstance(raw, dict):
        return None
    raw_nodes = raw.get("nodes")
    if not isinstance(raw_nodes, list) or not raw_nodes:
        return None

    nodes: list[PlanNode] = []
    seen_keys: set[str] = set()
    for item in raw_nodes:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key", "")).strip().lower()
        agent = str(item.get("agent", "")).strip().lower()
        title = str(item.get("title", "")).strip()
        intent = str(item.get("intent", "")).strip()
        if not (_KEY_RE.match(key) and title and intent):
            continue
        if key in seen_keys or agent not in known_agents:
            continue

        slug = item.get("integration_slug") or None
        if slug is not None:
            slug = str(slug).strip().lower()
            # Never plan against something the org has not connected.
            if slug not in connected_slugs:
                slug = None

        # Integrations are owned by specific agents. If the model picked one
        # that cannot reach this integration, move the step to an owner instead
        # of shipping a node guaranteed to fail once steps actually execute.
        if slug is not None and owners_by_slug:
            owners = [o for o in owners_by_slug.get(slug, []) if o in known_agents]
            if owners and agent not in owners:
                agent = owners[0]

        is_write = bool(item.get("is_write"))
        scope = item.get("expected_scope")
        deps = tuple(
            str(d).strip().lower()
            for d in (item.get("depends_on") or [])
            if isinstance(d, (str, int))
        )
        seen_keys.add(key)
        nodes.append(
            PlanNode(
                key=key,
                title=title,
                agent=agent,
                intent=intent,
                integration_slug=slug,
                depends_on=deps,
                is_write=is_write,
                expected_scope=(
                    str(scope).strip() if scope else ("unspecified" if is_write else None)
                ),
            )
        )

    # Drop references to nodes that did not survive validation.
    nodes = [
        replace(n, depends_on=tuple(d for d in n.depends_on if d in seen_keys and d != n.key))
        for n in nodes
    ]

    if not (min_nodes <= len(nodes) <= MAX_NODES):
        # In an agent's own chat a one-node "plan" is just today's turn with
        # extra latency, so the floor is 2. The team room lowers it to 1: there
        # the graph is the point — it shows which agent and which connection
        # will do the work, even when that is a single step.
        return None
    if _has_cycle(nodes):
        logger.warning("planner returned a cyclic plan; rejecting")
        return None

    deliverables = tuple(
        str(k).strip().lower()
        for k in (raw.get("final_deliverables") or [])
        if str(k).strip().lower() in seen_keys
    )
    unavailable = tuple(u for u in (raw.get("unavailable") or []) if isinstance(u, dict))

    return Plan(
        goal=str(raw.get("goal", "")).strip(),
        nodes=tuple(nodes),
        unavailable=unavailable,
        final_deliverables=deliverables or tuple(n.key for n in nodes[-1:]),
        model_used=model_used,
        gate_score=gate_score,
    )


def build_system_prompt(
    *,
    agent_descriptions: dict[str, str],
    catalog: list[dict],
    tool_names_by_slug: dict[str, list[str]],
    native_tools_by_agent: dict[str, list[str]] | None = None,
) -> str:
    native_tools_by_agent = native_tools_by_agent or {}

    def _agent_line(slug: str, desc: str) -> str:
        # Native tools matter as much as MCP ones here. Without them the
        # planner only knows what an agent can reach in a third-party system,
        # so it cannot plan the half of the work Veqiro does itself - Maya
        # generating an image is invisible, and a post step gets planned with
        # no way to produce the media it needs.
        native = ", ".join(native_tools_by_agent.get(slug, []))
        return f"- {slug}: {desc}" + (f"; built-in tools: {native}" if native else "")

    agents_block = "\n".join(
        _agent_line(k, v) for k, v in agent_descriptions.items()
    )
    connected = [c for c in catalog if c.get("connected")]
    if connected:
        lines = []
        for c in connected:
            slug = c.get("slug", "")
            # Names only, never schemas: this is what stops the planner
            # inventing a step against a tool the org does not actually have.
            tools = ", ".join(tool_names_by_slug.get(slug, [])[:40]) or "(tools not listed)"
            owners = ", ".join(c.get("agents") or []) or "unknown"
            lines.append(
                f"- {slug} ({c.get('name', slug)}) — usable by: {owners}; tools: {tools}"
            )
        connected_block = "\n".join(lines)
    else:
        connected_block = "(none connected)"

    return (
        "You break a user's request into an ordered graph of small steps, each "
        "handled by one specialist agent.\n\n"
        f"Specialists:\n{agents_block}\n\n"
        f"Connected integrations and their available tools:\n{connected_block}\n\n"
        "Rules:\n"
        f"- At most {MAX_NODES} steps. One action per step.\n"
        "- `depends_on` lists keys of steps that must finish first. Leave it "
        "empty when steps are genuinely independent so they can run in parallel.\n"
        "- Set `is_write` true for anything that creates, modifies, sends or "
        "deletes something outside Veqiro. Give those an `expected_scope` "
        "describing the blast radius (e.g. 'one issue per page, at most 20').\n"
        "- Never plan a step against an integration that is not connected. Put "
        "it in `unavailable` with a reason instead.\n"
        "- `integration_slug` must be one of the connected slugs above, or null.\n"
        "- A step that uses an agent's built-in tools (generating an image, drafting copy, analysing data) takes `integration_slug: null`. Plan those steps too - they are how the work gets made before it is published anywhere.\n"
        "- A step's `agent` MUST be one of the agents listed as able to use "
        "its `integration_slug`. Assigning an integration to an agent that "
        "cannot reach it produces a step that fails.\n\n"
        "- Do NOT split creating a document, sheet or issue from filling it in. One step creates it AND populates it. A separate populate step has no way to reference what the first one made, so it stalls asking for an id.\n"
        "- Any step that uses data an earlier step produced MUST list that step in `depends_on`. A write step that reports findings almost always depends on the step that found them.\n\n"
        "Respond in JSON:\n"
        '{"goal": "...", "nodes": [{"key": "s1", "title": "...", "agent": "...", '
        '"intent": "...", "integration_slug": "..."|null, "depends_on": [], '
        '"is_write": false, "expected_scope": null}], '
        '"unavailable": [{"need": "...", "why": "..."}], "final_deliverables": ["s1"]}'
    )


async def build_plan(
    llm: LLMClient,
    message: str,
    *,
    agent_descriptions: dict[str, str],
    catalog: list[dict],
    tool_names_by_slug: dict[str, list[str]],
    connected_slugs: set[str],
    native_tools_by_agent: dict[str, list[str]] | None = None,
    gate_score: int = 0,
    min_nodes: int = MIN_NODES,
) -> Plan | None:
    """Ask for a DAG and validate it. None means 'take the normal path'."""
    owners_by_slug = {
        str(c.get("slug", "")).lower(): [str(a).lower() for a in (c.get("agents") or [])]
        for c in catalog
        if c.get("slug")
    }
    system = build_system_prompt(
        agent_descriptions=agent_descriptions,
        catalog=catalog,
        tool_names_by_slug=tool_names_by_slug,
        native_tools_by_agent=native_tools_by_agent,
    )
    provider, model = PLANNER_MODEL
    try:
        raw = await llm.complete_json(
            provider=provider,
            model=model,
            system=system,
            messages=[{"role": "user", "content": message}],
            temperature=0.2,
        )
    except Exception:
        logger.warning("planner call failed; falling back to single-pass", exc_info=True)
        return None

    return validate_plan(
        raw,
        known_agents=set(agent_descriptions),
        connected_slugs=connected_slugs,
        gate_score=gate_score,
        model_used=model,
        min_nodes=min_nodes,
        owners_by_slug=owners_by_slug,
    )
