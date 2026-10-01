"""Fitting the memory block into an agent's prompt without losing what the customer saved.

The block is a few sections, in this order: the running summary, org context, goals, and
finally "Established Facts". The facts are the part a customer edits on the Memory screen —
what they told an employee to remember — so the contract is simple: **if it is an active
memory, the agent sees it.**

The previous fit was a character cut. For a short message ("And about ABC Corp ?") it kept
the first 1200 characters, and since the facts come last, a long summary pushed them out:
XYZ Corp's payment survived, ABC Corp's did not, and the agent confidently answered that
ABC "isn't in memory". Trimming has to be by section, and the facts section is the one
thing it never touches. What gets shortened instead is the summary, which is regenerated
every few turns and is the cheapest thing to lose.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

FACTS_HEADING = "## Established Facts"

# Budget for the whole block. A short message ("what about X?") does not need the long
# summary, so it gets the smaller one — but only the summary sections give way.
SHORT_MESSAGE_WORDS = 5
SHORT_MESSAGE_LIMIT = 1200
HARD_CAP = 8000

# How many facts one prompt carries. The server sends up to 200, ordered so the ones the
# customer stated or confirmed come last; this keeps the tail. Anything dropped is logged,
# because a fact that silently never reaches the agent looks exactly like an agent that
# forgot it.
MAX_FACTS = 60
# One runaway fact must not be able to crowd out the rest.
MAX_FACT_CHARS = 500

# Don't keep a stub of a section: a 40-character scrap of summary is noise.
_MIN_PARTIAL_CHARS = 200


def build_facts_section(facts: list[str]) -> str:
    """The "Established Facts" section for the newest `MAX_FACTS` facts, or "" if none."""
    if not facts:
        return ""
    if len(facts) > MAX_FACTS:
        logger.warning(
            "memory facts over the prompt limit: sending the last %d of %d (dropped the %d lowest priority)",
            MAX_FACTS,
            len(facts),
            len(facts) - MAX_FACTS,
        )
    kept = facts[-MAX_FACTS:]
    lines = []
    for f in kept:
        text = f if len(f) <= MAX_FACT_CHARS else f[: MAX_FACT_CHARS - 1].rstrip() + "…"
        lines.append(f"• {text}")
    return f"{FACTS_HEADING}\n" + "\n".join(lines)


def fit_memory_block(block: str, message: str) -> str:
    """Shrink `block` to the budget for this message, keeping the facts section whole.

    Sections are dropped or shortened in order (summary first); the facts section is never
    cut, even if that leaves the block over budget — a few hundred extra tokens is a better
    failure than an agent that has forgotten something it was told.
    """
    if not block:
        return block

    limit = SHORT_MESSAGE_LIMIT if len(message.split()) <= SHORT_MESSAGE_WORDS else HARD_CAP
    if len(block) <= limit:
        return block

    # Every section starts with "## ", so splitting on a blank line before one is safe even
    # when a summary itself contains blank lines.
    sections = re.split(r"\n\n(?=## )", block)
    facts = [s for s in sections if s.startswith(FACTS_HEADING)]
    others = [s for s in sections if not s.startswith(FACTS_HEADING)]

    facts_text = "\n\n".join(facts)
    budget = limit - len(facts_text) - (2 if facts_text else 0)

    kept: list[str] = []
    for s in others:
        sep = 2 if kept else 0
        if len(s) + sep <= budget:
            kept.append(s)
            budget -= len(s) + sep
            continue
        remaining = budget - sep
        if remaining >= _MIN_PARTIAL_CHARS:
            kept.append(s[:remaining].rstrip())
        break

    fitted = "\n\n".join([*kept, *facts])
    logger.info(
        "memory block fitted %d -> %d chars (limit %d, %d/%d non-fact sections kept, facts intact)",
        len(block),
        len(fitted),
        limit,
        len(kept),
        len(others),
    )
    return fitted
