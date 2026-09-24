"""If it is an active memory, the agent sees it.

The regression this pins: a customer saved "XYZ corp pays every 2nd" and "ABC corp pays on the
1st" on the Memory screen, then asked Rex short questions ("And about ABC Corp ?"). The old fit
cut the block to its first 1200 characters for short messages; the facts come last, so a long
summary pushed the later fact out and Rex answered that ABC "isn't in memory".
"""

from core.context_routes import BuildContextRequest, build_context
from core.memory_block import (
    FACTS_HEADING,
    HARD_CAP,
    MAX_FACT_CHARS,
    MAX_FACTS,
    SHORT_MESSAGE_LIMIT,
    build_facts_section,
    fit_memory_block,
)

XYZ = "XYZ corp pays us every 2nd of the month but needs a mail followup everytime"
ABC = "We always get the payment from ABC corp on 1st of every month of 4000 rupees"
ARTWORK = "Do not alter the artwork/product itself in campaign visuals."

SHORT = "And about ABC Corp ?"  # 4 words
LONG = "Can you list every recurring payment we expect this month and when each is due?"


def _block(summary_chars: int = 0, facts=(XYZ, ABC, ARTWORK)) -> str:
    parts = []
    if summary_chars:
        parts.append("## What I Remember About This Client\n" + ("The client sells art. " * (summary_chars // 20 + 1))[:summary_chars])
    parts.append("## Organization Goals & Decisions\ngoal: grow")
    parts.append(build_facts_section(list(facts)))
    return "\n\n".join(parts)


def test_short_message_keeps_every_fact_when_the_summary_is_long():
    block = _block(summary_chars=3000)
    assert len(block) > SHORT_MESSAGE_LIMIT  # the old code cut this to 1200 chars

    fitted = fit_memory_block(block, SHORT)

    for fact in (XYZ, ABC, ARTWORK):
        assert fact in fitted


def test_the_old_cut_really_did_lose_the_later_fact():
    """Guards the test above: with the old behaviour this scenario drops ABC."""
    block = _block(summary_chars=3000)
    assert ABC not in block[:SHORT_MESSAGE_LIMIT]


def test_summary_gives_way_first_and_is_shortened():
    block = _block(summary_chars=3000)
    fitted = fit_memory_block(block, SHORT)
    assert len(fitted) < len(block)
    assert FACTS_HEADING in fitted


def test_facts_are_never_cut_even_when_they_alone_exceed_the_short_budget():
    facts = [f"fact number {i}: " + "x" * 60 for i in range(MAX_FACTS)]
    block = _block(summary_chars=500, facts=facts)
    assert len(build_facts_section(facts)) > SHORT_MESSAGE_LIMIT

    fitted = fit_memory_block(block, SHORT)

    for f in facts:
        assert f in fitted


def test_block_within_budget_is_returned_untouched():
    block = _block()
    assert len(block) <= SHORT_MESSAGE_LIMIT
    assert fit_memory_block(block, SHORT) == block


def test_long_message_uses_the_larger_cap_and_still_keeps_facts():
    block = _block(summary_chars=HARD_CAP + 2000)
    fitted = fit_memory_block(block, LONG)
    assert len(fitted) < len(block)
    for fact in (XYZ, ABC, ARTWORK):
        assert fact in fitted


def test_facts_stay_last_and_other_sections_keep_their_order():
    block = _block(summary_chars=3000)
    fitted = fit_memory_block(block, SHORT)
    # The facts section is the last one, and every other heading comes before it.
    assert fitted.rstrip().endswith(ARTWORK)
    other_headings = [i for i in range(len(fitted)) if fitted.startswith("## ", i) and not fitted.startswith(FACTS_HEADING, i)]
    assert all(i < fitted.index(FACTS_HEADING) for i in other_headings)


def test_empty_block_and_missing_facts_section():
    assert fit_memory_block("", SHORT) == ""
    no_facts = "## What I Remember About This Client\n" + "a " * 1500
    fitted = fit_memory_block(no_facts, SHORT)
    assert 0 < len(fitted) <= SHORT_MESSAGE_LIMIT


def test_facts_section_keeps_the_newest_when_over_the_limit():
    facts = [f"fact {i}" for i in range(MAX_FACTS + 15)]
    section = build_facts_section(facts)
    assert "fact 0\n" not in section + "\n"          # oldest dropped
    assert f"fact {MAX_FACTS + 14}" in section       # newest kept
    assert section.count("• ") == MAX_FACTS


def test_one_runaway_fact_cannot_crowd_out_the_rest():
    section = build_facts_section(["y" * 5000, XYZ])
    assert XYZ in section
    assert len(section) < MAX_FACT_CHARS + len(XYZ) + 100


def test_build_context_uses_the_facts_section_and_all_three_survive():
    """End to end through the route the server calls, then the fit the agent applies."""
    import asyncio

    req = BuildContextRequest(
        user_message=SHORT,
        running_summary="The client sells art. " * 200,
        long_term_facts=[ARTWORK, XYZ, ABC],
        org_id="org",
        agent="REX",
    )
    resp = asyncio.run(build_context(req))
    assert FACTS_HEADING in resp.memory_block

    fitted = fit_memory_block(resp.memory_block, SHORT)
    for fact in (XYZ, ABC, ARTWORK):
        assert fact in fitted
