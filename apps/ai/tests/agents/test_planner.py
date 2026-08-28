"""Covers the planner gate and plan validation (agents/planner.py).

Pure functions — no LLM, no network. The gate decides whether a turn pays for
planning at all, and validation is the only thing standing between raw model
output and a run the executor will actually perform.
"""

import pytest

from agents.planner import (
    MAX_NODES,
    GateResult,
    should_plan,
    validate_plan,
    build_system_prompt,
    confirm_with_model,
)

CONNECTED = {
    "google-search-console": "Google Search Console",
    "ahrefs": "Ahrefs",
    "linear": "Linear",
}
AGENTS = {"sage", "rex", "maya", "vega", "lex", "scout"}

LANDING = (
    "Audit our top twenty pages in Google Search Console, cross-check the "
    "rankings against Ahrefs, and open a prioritised fix-list in Linear."
)


# ── Gate ────────────────────────────────────────────────────────────────────

def _gate(msg, connected=CONNECTED) -> GateResult:
    return should_plan(msg, connected=connected)


def test_the_landing_page_request_plans_without_an_llm_call():
    """The sentence the product promises. It must clear the bar on signals
    alone — paying for a gate call on the flagship case would be absurd."""
    g = _gate(LANDING)
    assert g.verdict == "yes"
    assert g.score >= 4


@pytest.mark.parametrize("msg", [
    "thanks",
    "run my morning briefing",
    "draft a tweet about our launch",
    "what's on my calendar?",
])
def test_ordinary_single_step_requests_do_not_plan(msg):
    assert _gate(msg).verdict == "no"


def test_naming_one_integration_is_not_multi_step():
    """"Post this to Slack" is one action for an org that only has Slack."""
    g = _gate("Post this update to Slack", connected={"slack": "Slack"})
    assert g.verdict == "no"


def test_slug_and_display_name_count_as_one_mention():
    """Otherwise a single integration named twice inflates the score."""
    g = _gate("pull from linear and Linear", connected={"linear": "Linear"})
    assert "2 connected integrations" not in g.reason


def test_unconnected_integrations_do_not_earn_the_bonus():
    """Naming GSC/Ahrefs/Linear must not score when none are connected.

    The request still reads as multi-step on its other signals, so it drops to
    the "maybe" band and defers to the cheap gate model rather than planning
    outright — which is the correct outcome, not a miss.
    """
    connected_gate = _gate(LANDING)
    unconnected_gate = _gate(LANDING, connected={"notion": "Notion"})

    assert "connected integrations named" not in unconnected_gate.reason
    assert unconnected_gate.score < connected_gate.score
    assert unconnected_gate.verdict == "maybe"


def test_matches_how_people_actually_name_integrations():
    """Real phrasing never contains the slug.

    "check what's on my calendar" has to match google-calendar, or the gate
    scores zero on the single most ordinary multi-step request there is —
    which is exactly what happened the first time this ran against live data.
    """
    g = _gate(
        "Pull my unread Gmail from today, check what's on my calendar "
        "tomorrow, and draft a summary doc in Google Docs",
        connected={"gmail": "Gmail", "google-calendar": "Google Calendar"},
    )
    assert g.verdict == "yes"
    assert "2 connected integrations named" in g.reason


def test_vendor_prefix_is_stripped_when_matching():
    g = _gate(
        "compare the calendar against the docs and draft a summary",
        connected={"google-calendar": "Google Calendar", "google-docs": "Google Docs"},
    )
    assert "2 connected integrations named" in g.reason


def test_matching_respects_word_boundaries():
    """"meeting" must not count as a mention of google-meet."""
    g = _gate(
        "draft a meeting agenda and send it round to the team please now",
        connected={"google-meet": "Google Meet", "gmail": "Gmail"},
    )
    assert "connected integrations named" not in g.reason


def test_check_is_treated_as_an_action():
    """Dropped from the verb list once; it is among the commonest verbs users
    reach for, and its absence cost two points on a real request."""
    from agents.planner import _IMPERATIVES
    assert "check" in _IMPERATIVES


def test_sequencing_language_counts():
    g = _gate(
        "Pull last quarter from Stripe and then reconcile it against Google "
        "Sheets and draft the board summary",
        connected={"stripe": "Stripe", "google-sheets": "Google Sheets"},
    )
    assert g.verdict == "yes"
    assert "sequencing language" in g.reason


def test_gate_reports_why():
    assert _gate(LANDING).reason
    assert _gate("hi").reason == "very short"


@pytest.mark.asyncio
async def test_gate_model_falls_back_to_no_on_failure():
    """Fallback must be toward today's behaviour, never toward spending more."""
    class Boom:
        async def complete_json(self, **kw):
            raise RuntimeError("provider down")

    assert await confirm_with_model(Boom(), "ambiguous request") is False


# ── Validation ──────────────────────────────────────────────────────────────

def _raw(nodes, **extra):
    return {"goal": "g", "nodes": nodes, **extra}


def _node(key, *, agent="sage", deps=(), slug=None, is_write=False, **kw):
    return {
        "key": key, "title": f"Step {key}", "agent": agent,
        "intent": "do the thing", "depends_on": list(deps),
        "integration_slug": slug, "is_write": is_write, **kw,
    }


def _validate(raw):
    return validate_plan(
        raw, known_agents=AGENTS, connected_slugs=set(CONNECTED),
    )


def test_accepts_a_well_formed_plan():
    plan = _validate(_raw([
        _node("s1", slug="google-search-console"),
        _node("s2", deps=["s1"], slug="linear", is_write=True,
              expected_scope="one issue per page"),
    ]))
    assert plan is not None
    assert [n.key for n in plan.nodes] == ["s1", "s2"]
    assert plan.nodes[1].is_write is True


def test_rejects_a_cycle_outright():
    """Dropping the back-edge would run a plan the model never reasoned about."""
    assert _validate(_raw([
        _node("s1", deps=["s2"]),
        _node("s2", deps=["s1"]),
    ])) is None


def test_rejects_a_single_node_plan():
    """One node is today's chat turn with extra latency and a graph UI."""
    assert _validate(_raw([_node("s1")])) is None


def test_rejects_more_than_the_node_cap():
    assert _validate(_raw([_node(f"s{i}") for i in range(MAX_NODES + 1)])) is None


def test_drops_nodes_with_an_unknown_agent():
    plan = _validate(_raw([
        _node("s1"), _node("s2"), _node("s3", agent="nobody"),
    ]))
    assert plan is not None
    assert [n.key for n in plan.nodes] == ["s1", "s2"]


def test_drops_dangling_dependencies():
    """A dep on a node that did not survive must not block execution forever."""
    plan = _validate(_raw([
        _node("s1"), _node("s2", deps=["s1", "ghost"]),
    ]))
    assert plan is not None
    assert plan.nodes[1].depends_on == ("s1",)


def test_drops_self_dependency():
    plan = _validate(_raw([_node("s1"), _node("s2", deps=["s2"])]))
    assert plan is not None
    assert plan.nodes[1].depends_on == ()


def test_nulls_an_unconnected_integration_slug():
    """The step can still run; it just must not claim a connection the org
    does not have."""
    plan = _validate(_raw([_node("s1", slug="notion"), _node("s2")]))
    assert plan is not None
    assert plan.nodes[0].integration_slug is None


def test_writes_always_carry_a_scope():
    """The approval card needs something to show, since arguments do not exist
    yet at approval time."""
    plan = _validate(_raw([_node("s1"), _node("s2", is_write=True)]))
    assert plan is not None
    assert plan.nodes[1].expected_scope == "unspecified"


def test_reads_have_no_scope():
    plan = _validate(_raw([_node("s1"), _node("s2")]))
    assert plan.nodes[0].expected_scope is None


def test_deduplicates_repeated_keys():
    plan = _validate(_raw([_node("s1"), _node("s1"), _node("s2")]))
    assert plan is not None
    assert [n.key for n in plan.nodes] == ["s1", "s2"]


def test_rejects_malformed_input():
    for bad in [None, [], "nope", {}, {"nodes": None}, {"nodes": []}]:
        assert validate_plan(bad, known_agents=AGENTS, connected_slugs=set(CONNECTED)) is None


def test_falls_back_to_the_last_node_when_deliverables_are_missing():
    plan = _validate(_raw([_node("s1"), _node("s2", deps=["s1"])]))
    assert plan.final_deliverables == ("s2",)


def test_keeps_only_deliverables_that_exist():
    plan = _validate(_raw(
        [_node("s1"), _node("s2")], final_deliverables=["s2", "ghost"]
    ))
    assert plan.final_deliverables == ("s2",)


# ── Prompt ──────────────────────────────────────────────────────────────────

def test_prompt_lists_only_connected_integrations_and_their_tools():
    """Tool *names* are what stop the planner inventing a step against an
    integration the org does not have."""
    prompt = build_system_prompt(
        agent_descriptions={"sage": "SEO"},
        catalog=[
            {"slug": "linear", "name": "Linear", "connected": True},
            {"slug": "notion", "name": "Notion", "connected": False},
        ],
        tool_names_by_slug={"linear": ["LINEAR_CREATE_ISSUE"]},
    )
    assert "linear" in prompt
    assert "LINEAR_CREATE_ISSUE" in prompt
    assert "notion" not in prompt


def test_prompt_is_explicit_when_nothing_is_connected():
    prompt = build_system_prompt(
        agent_descriptions={"sage": "SEO"}, catalog=[], tool_names_by_slug={},
    )
    assert "(none connected)" in prompt
